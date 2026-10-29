import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditRole, ContractStatus, Prisma } from '@prisma/client';
import { hasPermission } from '../../../core/access-control/permissions';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { scopedContract } from '../contracts-query.service';
import { AuditPeopleQueryDto } from '../dto/audit-engagement.dto';
import { vietnamToday } from '../lifecycle/renewal.util';
import {
  CountedDeadline,
  evaluateDeadline,
  holdersAt,
  RESPONSIBLE_ROLES,
  responsibilityMoment,
  summarize,
} from './deadline.rules';

const DEADLINE_SELECT = {
  id: true,
  kind: true,
  originalDue: true,
  currentDue: true,
  achievedAt: true,
  _count: { select: { changes: true } },
  changes: { select: { reason: true }, orderBy: { changedAt: 'asc' } },
  engagement: {
    select: {
      id: true,
      roleHistory: true,
      contractService: {
        select: {
          id: true,
          period: true,
          serviceType: { select: { id: true, code: true, name: true } },
          contract: {
            select: {
              id: true,
              code: true,
              customer: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.AuditEngagementDeadlineSelect;

type DeadlineRow = Prisma.AuditEngagementDeadlineGetPayload<{
  select: typeof DEADLINE_SELECT;
}>;

interface Attributed extends CountedDeadline {
  row: DeadlineRow;
  userId: string;
  roles: AuditRole[];
}

const day = (date: Date) => date.toISOString().slice(0, 10);

/** Vai tính "hồ sơ đang giữ": theo bộ lọc vai, và chỉ vai chịu trách nhiệm loại hạn đang lọc (F10). */
function activeRoles(query: AuditPeopleQueryDto): AuditRole[] {
  const all: AuditRole[] = [
    AuditRole.MANAGER,
    AuditRole.LEAD,
    AuditRole.SIGNER1,
  ];
  return all.filter(
    (r) =>
      (!query.role || r === query.role) &&
      (!query.kind || RESPONSIBLE_ROLES[query.kind].includes(r)),
  );
}

/**
 * Tab Theo nhân sự (đặc tả 04-F2, khung đánh giá năng lực): đúng hạn hồ sơ kiểm toán theo người
 * chịu trách nhiệm (F10) và phạm vi xem (F11). Không có số tiền.
 */
@Injectable()
export class AuditPeopleQuery {
  constructor(private readonly prisma: PrismaService) {}

  async people(user: AuthUser, query: AuditPeopleQueryDto) {
    const { from, to, rows } = await this.attributed(user, query);
    const visible = await this.visibleUsers(user, query.teamId);
    const byUser = new Map<string, Attributed[]>();
    for (const r of rows) {
      if (!visible.has(r.userId)) continue;
      byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
    }
    // Danh sách người lập theo phạm vi, độc lập với tập hạn: người đang giữ vai mà chưa có hạn
    // trong kỳ vẫn có một dòng, tỷ lệ "—" (review 22/10, R4).
    const active = await this.activeEngagements(
      user,
      [...visible.keys()],
      query.serviceTypeId,
      activeRoles(query),
    );
    const userIds = new Set([...byUser.keys(), ...active.keys()]);
    const items = [...userIds]
      .map((userId) => ({
        user: visible.get(userId)!,
        activeEngagements: active.get(userId) ?? 0,
        ...summarize(byUser.get(userId) ?? []),
      }))
      .sort((a, b) => a.user.fullName.localeCompare(b.user.fullName, 'vi'));
    return { from, to, items };
  }

  /** Danh sách hạn được tính cho một người, để đối chiếu con số. */
  async person(user: AuthUser, userId: string, query: AuditPeopleQueryDto) {
    const visible = await this.visibleUsers(user, query.teamId);
    const person = visible.get(userId);
    if (!person)
      throw new ForbiddenException('Bạn không được xem số liệu của người này');
    const { from, to, rows } = await this.attributed(user, query);
    const mine = rows.filter((r) => r.userId === userId);
    return {
      from,
      to,
      user: person,
      summary: summarize(mine),
      items: mine
        .sort((a, b) => a.row.currentDue.getTime() - b.row.currentDue.getTime())
        .map((r) => {
          const line = r.row.engagement.contractService;
          return {
            deadlineId: r.row.id,
            kind: r.row.kind,
            roles: r.roles,
            contract: { id: line.contract.id, code: line.contract.code },
            customer: line.contract.customer,
            serviceType: line.serviceType,
            period: line.period,
            originalDue: day(r.row.originalDue),
            currentDue: day(r.row.currentDue),
            achievedAt: r.row.achievedAt,
            current: r.current,
            original: r.original,
            extensions: r.extensions,
            extensionReasons: r.row.changes.map((c) => c.reason),
          };
        }),
    };
  }

  /** Hạn trong kỳ thuộc HĐ người xem được, gán cho người chịu trách nhiệm tại thời điểm hạn đến. */
  private async attributed(user: AuthUser, query: AuditPeopleQueryDto) {
    if (!hasPermission(user, 'tasks', 'view'))
      throw new ForbiddenException('Bạn không có quyền xem đánh giá nhân sự');
    const today = vietnamToday();
    const year = today.getUTCFullYear();
    const from = query.from ?? `${year}-01-01`;
    const to = query.to ?? `${year}-12-31`;
    const deadlines = await this.prisma.auditEngagementDeadline.findMany({
      where: {
        currentDue: { gte: new Date(from), lte: new Date(to) },
        ...(query.kind && { kind: query.kind }),
        engagement: {
          contractService: {
            ...(query.serviceTypeId && { serviceTypeId: query.serviceTypeId }),
            contract: scopedContract(user, {
              status: { not: ContractStatus.CANCELLED },
            }),
          },
        },
      },
      select: DEADLINE_SELECT,
    });
    const now = new Date();
    const rows: Attributed[] = [];
    for (const row of deadlines) {
      const roles = RESPONSIBLE_ROLES[row.kind].filter(
        (r) => !query.role || r === query.role,
      );
      const moment = responsibilityMoment(row.currentDue, row.achievedAt, now);
      const evaluated = evaluateDeadline(row, today);
      for (const [userId, held] of holdersAt(
        row.engagement.roleHistory,
        roles,
        moment,
      ))
        rows.push({
          row,
          userId,
          roles: held,
          current: evaluated.current,
          original: evaluated.original,
          extensions: row._count.changes,
        });
    }
    return { from, to, rows };
  }

  /** F11: Giám đốc tất cả; Kế toán trưởng người trong nhóm mình; nhân viên chỉ chính mình. */
  private async visibleUsers(user: AuthUser, teamId?: string) {
    const all = hasPermission(user, 'contracts', 'approve');
    const team = hasPermission(user, 'contracts', 'plan') && user.teamId;
    const where: Prisma.UserWhereInput = all
      ? {}
      : team
        ? { OR: [{ teamId: user.teamId }, { id: user.id }] }
        : { id: user.id };
    const users = await this.prisma.user.findMany({
      where: { AND: [where, teamId ? { teamId } : {}] },
      select: { id: true, fullName: true, teamId: true },
    });
    return new Map(users.map((u) => [u.id, u]));
  }

  /** Số hồ sơ chưa phát hành người đó đang giữ vai Manager / trưởng nhóm / người ký 1. */
  private async activeEngagements(
    user: AuthUser,
    userIds: string[],
    serviceTypeId: string | undefined,
    roles: AuditRole[],
  ) {
    const spans = await this.prisma.auditEngagementRoleHistory.findMany({
      where: {
        userId: { in: userIds },
        toAt: null,
        role: { in: roles },
        engagement: {
          stage: { not: 'ISSUED' },
          contractService: {
            ...(serviceTypeId && { serviceTypeId }),
            contract: scopedContract(user, {
              status: { not: ContractStatus.CANCELLED },
            }),
          },
        },
      },
      select: { userId: true, engagementId: true },
    });
    const sets = new Map<string, Set<string>>();
    for (const s of spans)
      sets.set(s.userId, (sets.get(s.userId) ?? new Set()).add(s.engagementId));
    return new Map([...sets].map(([id, set]) => [id, set.size]));
  }
}
