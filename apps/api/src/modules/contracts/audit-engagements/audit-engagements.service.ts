import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditStage,
  ContractStatus,
  DocumentCategory,
  Prisma,
  Role,
} from '@prisma/client';
import { hasPermission } from '../../../core/access-control/permissions';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import type { UploadedFileInfo } from '../../../core/storage/storage.service';
import { validateDocumentFile } from '../../documents/document-file.util';
import { DocumentsService } from '../../documents/documents.service';
import {
  ChangeAuditStageDto,
  IssueAuditReportDto,
  ReopenAuditReportDto,
  SaveAuditEngagementDto,
} from '../dto/audit-engagement.dto';
import { vietnamToday } from '../lifecycle/renewal.util';
import {
  diffRoles,
  isBackward,
  REASON_MAX,
  REASON_MIN,
  reportNumberKey,
  roleAssignments,
  STAGE_CONTRACT_STATUSES,
  stageMoveError,
  TeamInput,
  teamError,
  validReason,
} from './audit-engagement.rules';
import { AuditDeadlinesService } from './audit-deadlines.service';
import { syncMilestoneDues } from '../../payments/installment-milestone';
import {
  AuditEngagementsQuery,
  canEditEngagement,
  EngagementContract,
  EngagementLine,
} from './audit-engagements.query';

type Tx = Prisma.TransactionClient;
type Engagement = NonNullable<EngagementLine['audit']>;

const CONFLICT = 'Hồ sơ kiểm toán đã được người khác cập nhật, tải lại để xem';
const { NOT_STARTED, AWAITING_ISSUE, ISSUED } = AuditStage;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

/**
 * Hồ sơ kiểm toán theo dòng dịch vụ (đặc tả 04-F): nhóm, người ký, giai đoạn BCKT, phát hành và
 * mở lại. Mọi lệnh kiểm tra `revision` (khoá lạc quan), ghi lịch sử vai, mốc giai đoạn và audit.
 */
@Injectable()
export class AuditEngagementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: AuditEngagementsQuery,
    private readonly documents: DocumentsService,
    private readonly deadlines: AuditDeadlinesService,
  ) {}

  async save(
    user: AuthUser,
    contractId: string,
    lineId: string,
    dto: SaveAuditEngagementDto,
  ) {
    const { contract, engagement } = await this.loadLine(
      user,
      contractId,
      lineId,
    );
    if (contract.status === ContractStatus.CANCELLED)
      throw new BadRequestException('Hợp đồng đã huỷ, chỉ xem được');
    this.ensureCanEdit(user, engagement);
    if (engagement?.stage === ISSUED)
      throw new BadRequestException(
        'Báo cáo đã phát hành; mở lại trước khi sửa nhóm hoặc người ký',
      );
    const team: TeamInput = {
      managerId: dto.managerId ?? null,
      leadId: dto.leadId ?? null,
      signer1Id: dto.signer1Id ?? null,
      signer2Id: dto.signer2Id ?? null,
      assistantIds: dto.assistantIds ?? [],
    };
    const error = teamError(team);
    if (error) throw new BadRequestException(error);
    await this.ensureInternalUsers(roleAssignments(team).map((a) => a.userId));
    const dues = this.deadlines.planned(engagement, dto);
    this.ensureRevision(engagement, dto.revision);
    const before = engagement ? currentTeam(engagement) : emptyTeam();
    await this.run(async (tx) => {
      const id = await this.upsert(tx, lineId, engagement, {
        managerId: team.managerId,
        leadId: team.leadId,
        signer1Id: team.signer1Id,
        signer2Id: team.signer2Id,
      });
      await tx.auditEngagementMember.deleteMany({
        where: { engagementId: id },
      });
      await tx.auditEngagementMember.createMany({
        data: team.assistantIds.map((userId, sortOrder) => ({
          engagementId: id,
          userId,
          sortOrder,
        })),
      });
      await this.recordRoles(tx, id, before, team);
      await this.deadlines.applyPlanned(tx, id, dues);
      const fields = changedFields(before, team);
      const dueKinds = Object.keys(dues);
      if (fields.length || dueKinds.length)
        await this.audit(tx, user, contractId, 'ENGAGEMENT_UPDATE', {
          lineId,
          fields: [...fields, ...dueKinds],
          before: pickTeam(before, fields),
          after: pickTeam(team, fields),
          dues: Object.fromEntries(
            Object.entries(dues).map(([k, v]) => [
              k,
              v ? v.toISOString().slice(0, 10) : null,
            ]),
          ),
        });
    });
    return this.query.get(user, contractId);
  }

  async changeStage(
    user: AuthUser,
    contractId: string,
    lineId: string,
    dto: ChangeAuditStageDto,
  ) {
    const { contract, engagement } = await this.loadLine(
      user,
      contractId,
      lineId,
    );
    this.ensureStageAllowed(contract);
    this.ensureCanEdit(user, engagement);
    const from = engagement?.stage ?? NOT_STARTED;
    const error = stageMoveError(from, dto.stage, dto.reason);
    if (error) throw new BadRequestException(error);
    this.deadlines.ensureCanStart(engagement, dto.stage);
    this.ensureRevision(engagement, dto.revision);
    const reason = isBackward(from, dto.stage) ? dto.reason!.trim() : null;
    await this.run(async (tx) => {
      const id = await this.upsert(tx, lineId, engagement, {
        stage: dto.stage,
      });
      await this.recordStage(tx, user, contractId, id, from, dto.stage, reason);
    });
    return this.query.get(user, contractId);
  }

  async issue(
    user: AuthUser,
    contractId: string,
    lineId: string,
    file: UploadedFileInfo | undefined,
    dto: IssueAuditReportDto,
  ) {
    const { contract, engagement } = await this.loadLine(
      user,
      contractId,
      lineId,
    );
    this.ensureStageAllowed(contract);
    if (engagement?.stage !== AWAITING_ISSUE)
      throw new BadRequestException('Chỉ phát hành hồ sơ đang Chờ phát hành');
    this.ensureRevision(engagement, dto.revision);
    const { reportDate, signer1Id, number, key } = await this.validateIssue(
      contract,
      engagement,
      dto,
    );
    const document = file
      ? await this.storeReport(user, contract, file, number)
      : null;
    try {
      await this.run(async (tx) => {
        const done = await tx.auditEngagement.updateMany({
          where: {
            id: engagement.id,
            revision: engagement.revision,
            stage: AWAITING_ISSUE,
          },
          data: {
            stage: ISSUED,
            reportNumber: number,
            reportNumberKey: key,
            reportDate,
            signer1Id,
            ...(document && { reportDocumentId: document.id }),
            issuedById: user.id,
            issuedAt: new Date(),
            revision: { increment: 1 },
          },
        });
        if (!done.count) throw new ConflictException(CONFLICT);
        await this.recordRoles(tx, engagement.id, currentTeam(engagement), {
          ...currentTeam(engagement),
          signer1Id,
        });
        await this.recordStage(
          tx,
          user,
          contractId,
          engagement.id,
          AWAITING_ISSUE,
          ISSUED,
          null,
          {
            lineId,
            number,
            reportDate: dto.reportDate,
          },
        );
        // 07 J10: đợt thu "sau phát hành BCKT" nhận hạn theo ngày phát hành.
        await syncMilestoneDues(tx, contractId);
      });
    } catch (error) {
      if (document) await this.documents.remove(user, document.id);
      if (isUniqueViolation(error))
        throw new ConflictException(
          'Số báo cáo kiểm toán đã được dùng cho hồ sơ khác',
        );
      throw error;
    }
    return this.query.get(user, contractId);
  }

  async reopen(
    user: AuthUser,
    contractId: string,
    lineId: string,
    dto: ReopenAuditReportDto,
  ) {
    const { engagement } = await this.loadLine(user, contractId, lineId);
    if (engagement?.stage !== ISSUED)
      throw new BadRequestException('Chỉ mở lại báo cáo đã phát hành');
    if (!validReason(dto.reason))
      throw new BadRequestException(
        `Mở lại phải ghi lý do (${REASON_MIN}–${REASON_MAX} ký tự)`,
      );
    this.ensureRevision(engagement, dto.revision);
    await this.run(async (tx) => {
      await this.upsert(tx, lineId, engagement, { stage: AWAITING_ISSUE });
      await this.recordStage(
        tx,
        user,
        contractId,
        engagement.id,
        ISSUED,
        AWAITING_ISSUE,
        dto.reason.trim(),
        {
          lineId,
          number: engagement.reportNumber,
        },
      );
      // 07 J10: mở lại → đợt thu theo mốc quay về Chờ phát hành.
      await syncMilestoneDues(tx, contractId);
    });
    return this.query.get(user, contractId);
  }

  private async loadLine(user: AuthUser, contractId: string, lineId: string) {
    const contract = await this.query.load(user, contractId);
    const line = contract.services.find((s) => s.id === lineId);
    if (!line) {
      const exists = await this.prisma.contractService.count({
        where: { id: lineId, contractId },
      });
      if (exists)
        throw new BadRequestException(
          'Dịch vụ này không phát hành báo cáo kiểm toán',
        );
      throw new NotFoundException('Không tìm thấy dòng dịch vụ của hợp đồng');
    }
    return { contract, engagement: line.audit };
  }

  /** Phát hành (F4): ngày trong [ngày bắt đầu HĐ, hôm nay], có người ký 1 hợp lệ, số BCKT chưa dùng (F5). */
  private async validateIssue(
    contract: EngagementContract,
    engagement: Engagement,
    dto: IssueAuditReportDto,
  ) {
    const reportDate = new Date(dto.reportDate);
    if (Number.isNaN(reportDate.getTime()))
      throw new BadRequestException('Ngày phát hành không hợp lệ');
    if (reportDate > vietnamToday())
      throw new BadRequestException('Ngày phát hành không được sau hôm nay');
    if (reportDate < contract.startDate)
      throw new BadRequestException(
        'Ngày phát hành không được trước ngày bắt đầu hợp đồng',
      );
    const signer1Id = dto.signer1Id ?? engagement.signer1Id;
    if (!signer1Id)
      throw new BadRequestException(
        'Vui lòng chọn người ký 1 trước khi phát hành',
      );
    if (signer1Id === engagement.signer2Id)
      throw new BadRequestException('Người ký 1 và người ký 2 phải khác nhau');
    await this.ensureInternalUsers([signer1Id]);
    const number = dto.reportNumber.trim();
    if (!number)
      throw new BadRequestException('Vui lòng nhập số báo cáo kiểm toán');
    const key = reportNumberKey(number);
    await this.ensureNumberFree(key, engagement.id);
    return { reportDate, signer1Id, number, key };
  }

  private ensureCanEdit(user: AuthUser, engagement: Engagement | null) {
    if (!canEditEngagement(user, engagement))
      throw new ForbiddenException(
        'Chỉ Giám đốc, Kế toán trưởng hoặc trưởng nhóm của hồ sơ được cập nhật',
      );
  }

  private ensureStageAllowed(contract: EngagementContract) {
    if (!STAGE_CONTRACT_STATUSES.includes(contract.status))
      throw new BadRequestException(
        'Chỉ chuyển giai đoạn hoặc phát hành cho hợp đồng đã duyệt, chưa huỷ',
      );
  }

  private ensureRevision(engagement: Engagement | null, revision: number) {
    if ((engagement?.revision ?? 0) !== revision)
      throw new ConflictException(CONFLICT);
  }

  /** Tài khoản nội bộ đang hoạt động, không phải quản trị (F3). */
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

  private async ensureNumberFree(key: string, engagementId: string) {
    const taken = await this.prisma.auditEngagement.count({
      where: { reportNumberKey: key, id: { not: engagementId } },
    });
    if (taken)
      throw new ConflictException(
        'Số báo cáo kiểm toán đã được dùng cho hồ sơ khác',
      );
  }

  private async storeReport(
    user: AuthUser,
    contract: EngagementContract,
    file: UploadedFileInfo,
    number: string,
  ) {
    if (!hasPermission(user, 'documents', 'create'))
      throw new ForbiddenException('Bạn không có quyền tải hồ sơ lên kho');
    if (validateDocumentFile(file).mimetype !== 'application/pdf')
      throw new BadRequestException('File báo cáo kiểm toán phải là PDF');
    return this.documents.upload(user, contract.customerId, file, {
      category: DocumentCategory.SERVICE,
      contractId: contract.id,
      note: `Báo cáo kiểm toán số ${number}`,
    });
  }

  /** Tạo hồ sơ khi lưu lần đầu (hai người tạo cùng lúc → 409) hoặc cập nhật có điều kiện theo revision. */
  private async upsert(
    tx: Tx,
    lineId: string,
    engagement: Engagement | null,
    data: Prisma.AuditEngagementUncheckedUpdateManyInput,
  ): Promise<string> {
    if (!engagement) {
      const created = await tx.auditEngagement.create({
        data: {
          ...(data as Prisma.AuditEngagementUncheckedCreateInput),
          contractServiceId: lineId,
        },
      });
      return created.id;
    }
    const done = await tx.auditEngagement.updateMany({
      where: { id: engagement.id, revision: engagement.revision },
      data: { ...data, revision: { increment: 1 } },
    });
    if (!done.count) throw new ConflictException(CONFLICT);
    return engagement.id;
  }

  private async recordRoles(
    tx: Tx,
    engagementId: string,
    before: TeamInput,
    after: TeamInput,
  ) {
    const { closed, opened } = diffRoles(
      roleAssignments(before),
      roleAssignments(after),
    );
    const now = new Date();
    for (const a of closed)
      await tx.auditEngagementRoleHistory.updateMany({
        where: { engagementId, role: a.role, userId: a.userId, toAt: null },
        data: { toAt: now },
      });
    if (opened.length)
      await tx.auditEngagementRoleHistory.createMany({
        data: opened.map((a) => ({ engagementId, ...a, fromAt: now })),
      });
  }

  private async recordStage(
    tx: Tx,
    user: AuthUser,
    contractId: string,
    engagementId: string,
    from: AuditStage,
    to: AuditStage,
    reason: string | null,
    extra: Prisma.InputJsonObject = {},
  ) {
    await tx.auditEngagementStageEvent.create({
      data: {
        engagementId,
        fromStage: from,
        toStage: to,
        reason,
        actorId: user.id,
      },
    });
    await this.deadlines.onStage(tx, engagementId, to);
    const action =
      to === ISSUED
        ? 'REPORT_ISSUE'
        : from === ISSUED
          ? 'REPORT_REOPEN'
          : 'ENGAGEMENT_STAGE';
    await this.audit(tx, user, contractId, action, {
      from,
      to,
      reason,
      ...extra,
    });
  }

  private async audit(
    tx: Tx,
    user: AuthUser,
    contractId: string,
    action: string,
    detail: Prisma.InputJsonObject,
  ) {
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action,
        entity: 'contracts',
        entityId: contractId,
        detail,
      },
    });
  }

  private async run(work: (tx: Tx) => Promise<void>) {
    try {
      await this.prisma.$transaction(work);
    } catch (error) {
      // Hai người cùng lưu lần đầu: unique contract_service_id.
      if (
        isUniqueViolation(error) &&
        !String(
          (error as Prisma.PrismaClientKnownRequestError).meta?.target,
        ).includes('report_number')
      )
        throw new ConflictException(CONFLICT);
      throw error;
    }
  }
}

function emptyTeam(): TeamInput {
  return {
    managerId: null,
    leadId: null,
    signer1Id: null,
    signer2Id: null,
    assistantIds: [],
  };
}

function currentTeam(e: Engagement): TeamInput {
  return {
    managerId: e.managerId,
    leadId: e.leadId,
    signer1Id: e.signer1Id,
    signer2Id: e.signer2Id,
    assistantIds: e.members.map((m) => m.userId),
  };
}

const TEAM_FIELDS = [
  'managerId',
  'leadId',
  'signer1Id',
  'signer2Id',
  'assistantIds',
] as const;

function changedFields(before: TeamInput, after: TeamInput): string[] {
  return TEAM_FIELDS.filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  );
}

function pickTeam(team: TeamInput, fields: string[]): Prisma.InputJsonObject {
  return Object.fromEntries(
    fields.map((f) => [
      f,
      team[f as keyof TeamInput] as Prisma.InputJsonValue | null,
    ]),
  );
}
