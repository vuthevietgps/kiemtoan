import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus, Prisma, Role } from '@prisma/client';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { scopedContract } from '../contracts-query.service';
import { SaveServiceTeamDto } from '../dto/service-team.dto';
import {
  diffTeamRoles,
  emptyServiceTeam,
  ServiceTeamInput,
  serviceTeamError,
  serviceTeamRoles,
} from './service-team.rules';

type Tx = Prisma.TransactionClient;

const CONFLICT = 'Nhóm thực hiện đã được người khác cập nhật, tải lại để xem';

const TEAM_SELECT = {
  id: true,
  managerId: true,
  leadId: true,
  revision: true,
  members: { orderBy: { sortOrder: 'asc' }, select: { userId: true } },
} satisfies Prisma.ServiceTeamSelect;

type StoredTeam = Prisma.ServiceTeamGetPayload<{ select: typeof TEAM_SELECT }>;

const toInput = (team: StoredTeam | null): ServiceTeamInput =>
  team
    ? {
        managerId: team.managerId,
        leadId: team.leadId,
        assistantIds: team.members.map((m) => m.userId),
      }
    : emptyServiceTeam();

/**
 * Nhóm thực hiện cho dòng dịch vụ không phát hành BCKT (đặc tả 05, H8): lưu cả đội hình theo
 * `revision`, ghi lịch sử vai để tính trách nhiệm đúng hạn (G1). Dòng kiểm toán dùng nhóm 04-F.
 */
@Injectable()
export class ServiceTeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: AuthUser, contractId: string, lineId: string) {
    const { team } = await this.loadLine(user, contractId, lineId);
    return this.view(lineId, team);
  }

  async save(
    user: AuthUser,
    contractId: string,
    lineId: string,
    dto: SaveServiceTeamDto,
  ) {
    const { contract, team } = await this.loadLine(user, contractId, lineId);
    if (contract.status === ContractStatus.CANCELLED)
      throw new BadRequestException('Hợp đồng đã huỷ, chỉ xem được');
    const next: ServiceTeamInput = {
      managerId: dto.managerId ?? null,
      leadId: dto.leadId ?? null,
      assistantIds: dto.assistantIds ?? [],
    };
    const error = serviceTeamError(next);
    if (error) throw new BadRequestException(error);
    await this.ensureInternalUsers(serviceTeamRoles(next).map((a) => a.userId));
    if ((team?.revision ?? 0) !== dto.revision)
      throw new ConflictException(CONFLICT);
    const before = toInput(team);
    await this.prisma
      .$transaction(async (tx) => {
        const id = await this.upsert(tx, lineId, team, next);
        await tx.serviceTeamMember.deleteMany({ where: { teamId: id } });
        await tx.serviceTeamMember.createMany({
          data: next.assistantIds.map((userId, sortOrder) => ({
            teamId: id,
            userId,
            sortOrder,
          })),
        });
        await this.recordRoles(tx, id, before, next);
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'SERVICE_TEAM_UPDATE',
            entity: 'contracts',
            entityId: contractId,
            detail: {
              lineId,
              before: { ...before },
              after: { ...next },
            },
          },
        });
      })
      .catch((err: unknown) => {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        )
          throw new ConflictException(CONFLICT);
        throw err;
      });
    return this.get(user, contractId, lineId);
  }

  private async loadLine(user: AuthUser, contractId: string, lineId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: scopedContract(user, { id: contractId }),
      select: {
        id: true,
        status: true,
        services: {
          where: { id: lineId },
          select: {
            serviceType: { select: { issuesAuditReport: true } },
            team: { select: TEAM_SELECT },
          },
        },
      },
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    const line = contract.services[0];
    if (!line)
      throw new NotFoundException('Không tìm thấy dòng dịch vụ của hợp đồng');
    if (line.serviceType.issuesAuditReport)
      throw new BadRequestException(
        'Dòng kiểm toán dùng nhóm kiểm toán ở tab Kiểm toán',
      );
    return { contract, team: line.team };
  }

  private async view(lineId: string, team: StoredTeam | null) {
    const input = toInput(team);
    const ids = serviceTeamRoles(input).map((a) => a.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const ref = (id: string | null) => (id ? (byId.get(id) ?? null) : null);
    return {
      lineId,
      revision: team?.revision ?? 0,
      manager: ref(input.managerId),
      lead: ref(input.leadId),
      assistants: input.assistantIds.map(ref).filter((u) => !!u),
    };
  }

  /** Tài khoản nội bộ đang hoạt động, không phải quản trị (như 04-F, F3). */
  private async ensureInternalUsers(ids: string[]) {
    const wanted = [...new Set(ids)];
    if (!wanted.length) return;
    const found = await this.prisma.user.count({
      where: {
        id: { in: wanted },
        isActive: true,
        deletedAt: null,
        leftAt: null,
        role: { not: Role.ADMIN },
      },
    });
    if (found !== wanted.length)
      throw new BadRequestException(
        'Người được chọn không tồn tại, đã nghỉ hoặc là tài khoản quản trị',
      );
  }

  /** Tạo khi lưu lần đầu (hai người tạo cùng lúc → 409) hoặc cập nhật có điều kiện theo revision. */
  private async upsert(
    tx: Tx,
    lineId: string,
    team: StoredTeam | null,
    next: ServiceTeamInput,
  ): Promise<string> {
    const data = { managerId: next.managerId, leadId: next.leadId };
    if (!team) {
      const created = await tx.serviceTeam.create({
        data: { ...data, contractServiceId: lineId },
      });
      return created.id;
    }
    const done = await tx.serviceTeam.updateMany({
      where: { id: team.id, revision: team.revision },
      data: { ...data, revision: { increment: 1 } },
    });
    if (!done.count) throw new ConflictException(CONFLICT);
    return team.id;
  }

  private async recordRoles(
    tx: Tx,
    teamId: string,
    before: ServiceTeamInput,
    after: ServiceTeamInput,
  ) {
    const { closed, opened } = diffTeamRoles(
      serviceTeamRoles(before),
      serviceTeamRoles(after),
    );
    const now = new Date();
    for (const a of closed)
      await tx.serviceTeamRoleHistory.updateMany({
        where: { teamId, role: a.role, userId: a.userId, toAt: null },
        data: { toAt: now },
      });
    if (opened.length)
      await tx.serviceTeamRoleHistory.createMany({
        data: opened.map((a) => ({ teamId, ...a, fromAt: now })),
      });
  }
}
