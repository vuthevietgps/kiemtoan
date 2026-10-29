import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AuditDeadlineKind, AuditStage, Prisma } from '@prisma/client';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import {
  ExtendAuditDeadlineDto,
  SaveAuditEngagementDto,
} from '../dto/audit-engagement.dto';
import { REASON_MAX, REASON_MIN, validReason } from './audit-engagement.rules';
import {
  AuditEngagementsQuery,
  EngagementLine,
} from './audit-engagements.query';
import {
  ACHIEVED_ON,
  DEADLINE_KINDS,
  deadlineOrderError,
} from './deadline.rules';

type Tx = Prisma.TransactionClient;
type Engagement = NonNullable<EngagementLine['audit']>;
/** Hạn dự kiến gửi kèm khi lưu nhóm: undefined = giữ nguyên, null = bỏ (chỉ trước khi chốt). */
export type PlannedDeadlines = Partial<Record<AuditDeadlineKind, Date | null>>;

const DTO_FIELD: Record<AuditDeadlineKind, keyof SaveAuditEngagementDto> = {
  FIELDWORK_END: 'fieldworkDue',
  REVIEW_END: 'reviewDue',
  REPORT_ISSUE: 'issueDue',
};
const CONFLICT = 'Hồ sơ kiểm toán đã được người khác cập nhật, tải lại để xem';

const day = (date: Date | null | undefined) =>
  date ? date.toISOString().slice(0, 10) : null;

/**
 * Hạn hồ sơ kiểm toán (đặc tả 04-F2, F9): sửa tự do trước khi chốt; chốt hạn gốc khi lần đầu sang
 * Đang kiểm toán; sau đó chỉ Giám đốc gia hạn kèm lý do; ghi mốc đạt lần đầu theo giai đoạn.
 */
@Injectable()
export class AuditDeadlinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: AuditEngagementsQuery,
  ) {}

  /** Kiểm tra hạn gửi kèm khi lưu nhóm; trả các hạn thay đổi (rỗng nếu không đổi). */
  planned(
    engagement: Engagement | null,
    dto: SaveAuditEngagementDto,
  ): PlannedDeadlines {
    const current = currentDues(engagement);
    const changes: PlannedDeadlines = {};
    for (const kind of DEADLINE_KINDS) {
      const raw = dto[DTO_FIELD[kind]] as string | null | undefined;
      if (raw === undefined) continue;
      const next = raw ? parseDay(raw) : null;
      if (day(next) === day(current[kind])) continue;
      changes[kind] = next;
    }
    if (!Object.keys(changes).length) return changes;
    if (engagement?.deadlinesLockedAt)
      throw new BadRequestException(
        'Hạn đã chốt khi bắt đầu kiểm toán; dùng chức năng gia hạn',
      );
    const error = deadlineOrderError({ ...current, ...changes });
    if (error) throw new BadRequestException(error);
    return changes;
  }

  async applyPlanned(tx: Tx, engagementId: string, changes: PlannedDeadlines) {
    for (const [kind, due] of Object.entries(changes) as [
      AuditDeadlineKind,
      Date | null,
    ][]) {
      if (!due) {
        await tx.auditEngagementDeadline.deleteMany({
          where: { engagementId, kind },
        });
        continue;
      }
      await tx.auditEngagementDeadline.upsert({
        where: { engagementId_kind: { engagementId, kind } },
        create: { engagementId, kind, originalDue: due, currentDue: due },
        update: { originalDue: due, currentDue: due },
      });
    }
  }

  /** Lần đầu sang Đang kiểm toán phải có hạn phát hành; khi đó chốt hạn gốc. */
  ensureCanStart(engagement: Engagement | null, to: AuditStage) {
    if (to !== AuditStage.FIELDWORK || engagement?.deadlinesLockedAt) return;
    const hasIssueDue = engagement?.deadlines.some(
      (d) => d.kind === AuditDeadlineKind.REPORT_ISSUE,
    );
    if (!hasIssueDue)
      throw new BadRequestException(
        'Đặt hạn phát hành báo cáo trước khi bắt đầu kiểm toán',
      );
  }

  /** Gọi trong transaction mỗi lần chuyển giai đoạn: chốt hạn và ghi mốc đạt lần đầu. */
  async onStage(tx: Tx, engagementId: string, to: AuditStage) {
    const now = new Date();
    if (to === AuditStage.FIELDWORK)
      await tx.auditEngagement.updateMany({
        where: { id: engagementId, deadlinesLockedAt: null },
        data: { deadlinesLockedAt: now },
      });
    const kinds = DEADLINE_KINDS.filter((k) => ACHIEVED_ON[k] === to);
    if (kinds.length)
      await tx.auditEngagementDeadline.updateMany({
        where: { engagementId, kind: { in: kinds }, achievedAt: null },
        data: { achievedAt: now },
      });
  }

  /** Gia hạn (F9): chỉ Giám đốc (kiểm tra quyền ở controller), có lý do, lịch sử không sửa/xoá. */
  async extend(
    user: AuthUser,
    contractId: string,
    lineId: string,
    kind: AuditDeadlineKind,
    dto: ExtendAuditDeadlineDto,
  ) {
    const contract = await this.query.load(user, contractId);
    const line = contract.services.find((s) => s.id === lineId);
    const engagement = line?.audit;
    if (!engagement?.deadlinesLockedAt)
      throw new BadRequestException(
        'Hạn chưa chốt; sửa hạn trực tiếp khi lưu nhóm kiểm toán',
      );
    if (engagement.stage === AuditStage.ISSUED)
      throw new BadRequestException(
        'Báo cáo đã phát hành; mở lại trước khi gia hạn',
      );
    if (!validReason(dto.reason))
      throw new BadRequestException(
        `Gia hạn phải ghi lý do (${REASON_MIN}–${REASON_MAX} ký tự)`,
      );
    const existing = engagement.deadlines.find((d) => d.kind === kind);
    if (existing?.achievedAt)
      throw new BadRequestException('Hạn đã đạt, không gia hạn được');
    const due = parseDay(dto.due);
    if (day(existing?.currentDue) === day(due))
      throw new BadRequestException('Hạn mới trùng hạn hiện tại');
    const error = deadlineOrderError({
      ...currentDues(engagement),
      [kind]: due,
    });
    if (error) throw new BadRequestException(error);
    if (engagement.revision !== dto.revision)
      throw new ConflictException(CONFLICT);
    const reason = dto.reason.trim();
    await this.prisma.$transaction(async (tx) => {
      const bumped = await tx.auditEngagement.updateMany({
        where: { id: engagement.id, revision: dto.revision },
        data: { revision: { increment: 1 } },
      });
      if (!bumped.count) throw new ConflictException(CONFLICT);
      const deadline = await tx.auditEngagementDeadline.upsert({
        where: { engagementId_kind: { engagementId: engagement.id, kind } },
        create: {
          engagementId: engagement.id,
          kind,
          originalDue: due,
          currentDue: due,
        },
        update: { currentDue: due },
      });
      await tx.auditEngagementDeadlineChange.create({
        data: {
          deadlineId: deadline.id,
          oldDue: existing?.currentDue ?? null,
          newDue: due,
          reason,
          changedById: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'DEADLINE_EXTEND',
          entity: 'contracts',
          entityId: contractId,
          detail: {
            lineId,
            type: kind,
            from: day(existing?.currentDue),
            to: day(due),
            reason,
          },
        },
      });
    });
    return this.query.get(user, contractId);
  }
}

function currentDues(engagement: Engagement | null): PlannedDeadlines {
  return Object.fromEntries(
    (engagement?.deadlines ?? []).map((d) => [d.kind, d.currentDue]),
  );
}

function parseDay(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || day(date) !== value)
    throw new BadRequestException('Ngày không hợp lệ');
  return date;
}
