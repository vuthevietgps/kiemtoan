import { Injectable, NotFoundException } from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import { customerScope } from '../../../core/access-control/data-scope';
import { hasPermission } from '../../../core/access-control/permissions';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { toAuthUser } from '../../../core/auth/auth-user.mapper';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { scopedContract } from '../contracts-query.service';
import { vietnamToday } from '../lifecycle/renewal.util';
import { auditYear } from './audit-engagement.rules';
import { DEADLINE_KINDS, evaluateDeadline } from './deadline.rules';

/** Tình trạng hồ sơ HĐ: gửi khách, lưu bản gốc, BBNT. */
export const DOSSIER_SELECT = {
  dossierRevision: true,
  clientDeliveryStatus: true,
  clientDeliveredAt: true,
  originalFilingStatus: true,
  originalFiledAt: true,
  originalFilingNote: true,
  acceptanceStatus: true,
  acceptanceSignedAt: true,
  acceptanceDocument: {
    select: {
      id: true,
      document: { select: { id: true, fileName: true } },
    },
  },
} satisfies Prisma.ContractSelect;

export type DossierRow = Prisma.ContractGetPayload<{
  select: typeof DOSSIER_SELECT;
}>;

/** Số dòng báo cáo tình hình hiện trên hồ sơ (mới nhất trước). */
export const NOTES_SHOWN = 100;

export const ENGAGEMENT_CONTRACT_SELECT = {
  id: true,
  code: true,
  status: true,
  startDate: true,
  customerId: true,
  ...DOSSIER_SELECT,
  services: {
    where: { serviceType: { issuesAuditReport: true } },
    orderBy: [{ period: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      period: true,
      description: true,
      serviceType: { select: { id: true, code: true, name: true } },
      audit: {
        include: {
          members: { orderBy: { sortOrder: 'asc' } },
          deadlines: {
            include: { changes: { orderBy: { changedAt: 'asc' } } },
          },
          stageEvents: { orderBy: { occurredAt: 'asc' } },
          notes: { orderBy: { createdAt: 'desc' }, take: NOTES_SHOWN },
        },
      },
      // Gợi ý hạn phát hành = hạn bước cuối của kế hoạch 04-B đã xác nhận.
      plan: {
        select: {
          status: true,
          steps: { where: { skipped: false }, select: { dueDate: true } },
        },
      },
    },
  },
} satisfies Prisma.ContractSelect;

export type EngagementContract = Prisma.ContractGetPayload<{
  select: typeof ENGAGEMENT_CONTRACT_SELECT;
}>;
export type EngagementLine = EngagementContract['services'][number];
type Engagement = NonNullable<EngagementLine['audit']>;

export interface UserRef {
  id: string;
  fullName: string;
  active: boolean;
}

const day = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

/** Người được sửa nhóm/giai đoạn trước phát hành (F2): có `contracts:plan` hoặc là trưởng nhóm hồ sơ. */
export function canEditEngagement(
  user: AuthUser,
  engagement: { leadId: string | null } | null,
): boolean {
  return (
    hasPermission(user, 'contracts', 'plan') || engagement?.leadId === user.id
  );
}

/** Người viết báo cáo tình hình (04-F4): người theo F2 hoặc thành viên nhóm/người ký của hồ sơ. */
export function canNoteEngagement(
  user: AuthUser,
  engagement: Parameters<typeof teamIds>[0] | null,
): boolean {
  return (
    canEditEngagement(user, engagement) ||
    (!!engagement && teamIds(engagement).includes(user.id))
  );
}

/** Đọc hồ sơ kiểm toán và tình trạng hồ sơ của một HĐ (04-F), dùng chung cho GET và kết quả lệnh. */
@Injectable()
export class AuditEngagementsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async load(user: AuthUser, contractId: string): Promise<EngagementContract> {
    const contract = await this.prisma.contract.findFirst({
      where: scopedContract(user, { id: contractId }),
      select: ENGAGEMENT_CONTRACT_SELECT,
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    return contract;
  }

  async get(user: AuthUser, contractId: string) {
    return this.view(user, await this.load(user, contractId));
  }

  async view(user: AuthUser, contract: EngagementContract) {
    const engagements = contract.services.map((line) => line.audit);
    const users = await this.userRefs(
      engagements.flatMap((e) =>
        e
          ? [
              ...teamIds(e),
              e.issuedById,
              ...e.stageEvents.map((s) => s.actorId),
              ...e.notes.map((n) => n.authorId),
              ...e.deadlines.flatMap((d) =>
                d.changes.map((c) => c.changedById),
              ),
            ]
          : [],
      ),
    );
    const today = vietnamToday();
    const cancelled = contract.status === ContractStatus.CANCELLED;
    const lines = await Promise.all(
      contract.services.map(async (line) => {
        const e = line.audit;
        const ref = (id: string | null | undefined) =>
          (id && users.get(id)) || null;
        return {
          lineId: line.id,
          serviceType: line.serviceType,
          period: line.period,
          description: line.description,
          year: auditYear(line.period, contract.startDate),
          engagement: {
            id: e?.id ?? null,
            stage: e?.stage ?? 'NOT_STARTED',
            priority: e?.priority ?? 'NORMAL',
            revision: e?.revision ?? 0,
            manager: ref(e?.managerId),
            lead: ref(e?.leadId),
            signer1: ref(e?.signer1Id),
            signer2: ref(e?.signer2Id),
            assistants: (e?.members ?? []).map((m) => ref(m.userId)),
            reportNumber: e?.reportNumber ?? null,
            reportDate: day(e?.reportDate ?? null),
            reportDocumentId: e?.reportDocumentId ?? null,
            issuedAt: e?.issuedAt ?? null,
            issuedBy: ref(e?.issuedById),
            deadlinesLocked: !!e?.deadlinesLockedAt,
            deadlines: deadlineViews(e, today, ref),
            suggestedIssueDue: suggestedIssueDue(line),
            timeline: (e?.stageEvents ?? []).map((s) => ({
              from: s.fromStage,
              to: s.toStage,
              reason: s.reason,
              actor: ref(s.actorId),
              occurredAt: s.occurredAt,
            })),
            notes: (e?.notes ?? []).map((n) => ({
              id: n.id,
              content: n.content,
              author: ref(n.authorId),
              createdAt: n.createdAt,
            })),
          },
          unassigned: e
            ? await this.unassigned(contract.customerId, teamIds(e), users)
            : [],
          canEdit:
            !cancelled && e?.stage !== 'ISSUED' && canEditEngagement(user, e),
          canPrioritize: !cancelled && canEditEngagement(user, e),
          canNote: !cancelled && canNoteEngagement(user, e),
          canIssue: !cancelled && hasPermission(user, 'contracts', 'approve'),
          canExtend:
            !cancelled &&
            !!e?.deadlinesLockedAt &&
            e.stage !== 'ISSUED' &&
            hasPermission(user, 'contracts', 'approve'),
        };
      }),
    );
    return {
      contract: {
        id: contract.id,
        code: contract.code,
        status: contract.status,
      },
      dossier: dossierView(contract),
      canEditDossier: !cancelled && hasPermission(user, 'contracts', 'update'),
      engagements: lines,
    };
  }

  private async userRefs(ids: (string | null)[]) {
    const wanted = [...new Set(ids.filter((v): v is string => !!v))];
    const rows = await this.prisma.user.findMany({
      where: { id: { in: wanted } },
      select: {
        id: true,
        fullName: true,
        isActive: true,
        deletedAt: true,
        leftAt: true,
      },
    });
    return new Map<string, UserRef>(
      rows.map((u) => [
        u.id,
        {
          id: u.id,
          fullName: u.fullName,
          active: u.isActive && !u.deletedAt && !u.leftAt,
        },
      ]),
    );
  }

  /** Người trong nhóm không xem được khách hàng này theo phạm vi dữ liệu (cảnh báo F6). */
  async unassigned(
    customerId: string,
    userIds: string[],
    users?: Map<string, UserRef>,
  ): Promise<UserRef[]> {
    const rows = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(userIds)] } },
      include: { accessRole: true },
    });
    const result: UserRef[] = [];
    for (const row of rows) {
      const visible = await this.prisma.customer.count({
        where: { AND: [{ id: customerId }, customerScope(toAuthUser(row))] },
      });
      if (!visible)
        result.push(
          users?.get(row.id) ?? {
            id: row.id,
            fullName: row.fullName,
            active: row.isActive,
          },
        );
    }
    return result;
  }
}

/** Ba hạn theo thứ tự, kèm kết quả theo hạn hiện hành và hạn gốc, lịch sử gia hạn. */
function deadlineViews(
  engagement: Engagement | null,
  today: Date,
  ref: (id: string) => UserRef | null,
) {
  return DEADLINE_KINDS.flatMap((kind) => {
    const d = engagement?.deadlines.find((x) => x.kind === kind);
    if (!d) return [];
    const evaluated = evaluateDeadline(d, today);
    return [
      {
        kind,
        originalDue: day(d.originalDue),
        currentDue: day(d.currentDue),
        achievedAt: d.achievedAt,
        ...evaluated,
        changes: d.changes.map((c) => ({
          oldDue: day(c.oldDue),
          newDue: day(c.newDue),
          reason: c.reason,
          changedBy: ref(c.changedById),
          changedAt: c.changedAt,
        })),
      },
    ];
  });
}

function suggestedIssueDue(line: EngagementLine): string | null {
  if (line.plan?.status !== 'CONFIRMED' || !line.plan.steps.length) return null;
  const last = Math.max(...line.plan.steps.map((s) => s.dueDate.getTime()));
  return day(new Date(last));
}

export function teamIds(engagement: Engagement): string[] {
  return [
    engagement.managerId,
    engagement.leadId,
    engagement.signer1Id,
    engagement.signer2Id,
    ...engagement.members.map((m) => m.userId),
  ].filter((id): id is string => !!id);
}

export function dossierView(contract: DossierRow) {
  return {
    revision: contract.dossierRevision,
    clientDeliveryStatus: contract.clientDeliveryStatus,
    clientDeliveredAt: day(contract.clientDeliveredAt),
    originalFilingStatus: contract.originalFilingStatus,
    originalFiledAt: day(contract.originalFiledAt),
    originalFilingNote: contract.originalFilingNote,
    acceptanceStatus: contract.acceptanceStatus,
    acceptanceSignedAt: day(contract.acceptanceSignedAt),
    acceptanceDocument: contract.acceptanceDocument
      ? {
          id: contract.acceptanceDocument.id,
          documentId: contract.acceptanceDocument.document.id,
          fileName: contract.acceptanceDocument.document.fileName,
        }
      : null,
  };
}
