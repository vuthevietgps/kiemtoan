import {
  NotificationKind,
  NotificationSeverity,
  Prisma,
  TokenCustody,
} from '@prisma/client';
import { nextWorkingDay } from '../service-catalog/workflow-schedule.util';
import type { PlanContext, PlannedReminder } from './reminder-planner';
import { CATCH_UP_DAYS, currentMilestone, fmtDate } from './reminder.rules';

/**
 * Nguồn nhắc kho tài khoản (đặc tả 09-C, L9) cho bộ nhắc 06: hạn chứng thư token / hạn tài khoản ở mốc
 * 30, 7, 1 ngày trước và đúng ngày hết hạn (người phụ trách KH + người đang mượn); token mượn đến hạn
 * trả (người mượn), quá 1 ngày làm việc (người mượn + người phụ trách KH). Khoá chống trùng của 06.
 */

type Db = Prisma.TransactionClient;
const DAY_MS = 86_400_000;
/** L9: mốc trước hạn (ngày). */
export const CREDENTIAL_EXPIRY_THRESHOLDS = [30, 7, 1];
const EXPIRY = 'EXP:';
const LOAN_DUE = 'LOAN:D0';
const LOAN_ESCALATION = 'LOAN:ESC';

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);
const link = (id: string) => `/client-credentials?id=${id}`;

const PROVIDER: Record<string, string> = {
  VNPT_CA: 'VNPT-CA',
  VIETTEL_CA: 'Viettel-CA',
  FPT_CA: 'FPT-CA',
  BKAV_CA: 'BKAV-CA',
  MISA_CA: 'MISA-CA',
  EASY_CA: 'EasyCA',
};

interface CredentialRow {
  id: string;
  type: string;
  label: string | null;
  username: string | null;
  provider: string | null;
  serialNumber: string | null;
  customer: { name: string; ownerId: string | null };
}

/** "Chữ ký số VNPT-CA TK-01 — Công ty A" / "Cổng thuế (mst) — Công ty A". Không bao giờ có bí mật. */
export function credentialSubject(c: CredentialRow): string {
  const name =
    c.type === 'DIGITAL_SIGNATURE'
      ? `Chữ ký số ${c.provider ? (PROVIDER[c.provider] ?? 'khác') : ''} ${c.serialNumber ?? ''}`
      : `${c.label ?? 'Tài khoản'}${c.username ? ` (${c.username})` : ''}`;
  return `${name.replace(/\s+/g, ' ').trim()} — ${c.customer.name}`;
}

/** Ngày bắt đầu báo người phụ trách KH: ngày làm việc đầu tiên sau hạn trả. */
export function loanEscalationDate(due: Date, ctx: PlanContext): Date {
  return nextWorkingDay(addDays(due, 1), ctx.calendar);
}

const SELECT = {
  id: true,
  type: true,
  label: true,
  username: true,
  provider: true,
  serialNumber: true,
  expiresAt: true,
  holderId: true,
  loanDueAt: true,
  customer: { select: { name: true, ownerId: true } },
} satisfies Prisma.ClientCredentialSelect;

export async function planCredentialReminders(
  db: Db,
  ctx: PlanContext,
): Promise<PlannedReminder[]> {
  const live = { deletedAt: null, customer: { deletedAt: null } };
  const [expiring, loans] = await Promise.all([
    db.clientCredential.findMany({
      where: {
        ...live,
        expiresAt: {
          gte: addDays(ctx.today, -CATCH_UP_DAYS),
          lte: addDays(ctx.today, CREDENTIAL_EXPIRY_THRESHOLDS[0]),
        },
      },
      select: SELECT,
    }),
    db.clientCredential.findMany({
      where: {
        ...live,
        custody: TokenCustody.LOANED,
        loanDueAt: { lte: ctx.today },
      },
      select: SELECT,
    }),
  ]);
  return [
    ...expiring.flatMap((c) => expiryReminder(c, ctx)),
    ...loans.flatMap((c) => loanReminder(c, ctx)),
  ];
}

/** Tiêu đề theo số ngày còn lại thực tế (mốc gửi bù vẫn ghi đúng số ngày). */
export function expiryTitle(
  label: string,
  subject: string,
  due: Date,
  today: Date,
): string {
  const left = Math.round((due.getTime() - today.getTime()) / DAY_MS);
  const head = left > 0 ? `${label} (còn ${left} ngày)` : 'Hết hạn hôm nay';
  return `${head}: ${subject}, hạn ${fmtDate(due)}`;
}

function expiryReminder(
  c: Prisma.ClientCredentialGetPayload<{ select: typeof SELECT }>,
  ctx: PlanContext,
): PlannedReminder[] {
  const due = c.expiresAt!;
  const m = currentMilestone(due, ctx.today, CREDENTIAL_EXPIRY_THRESHOLDS);
  // L9 dừng ở "đúng ngày hết hạn" — không có mốc quá hạn.
  if (!m || m.offset > 0) return [];
  return [
    {
      subjectType: 'CREDENTIAL',
      subjectId: c.id,
      milestone: `${EXPIRY}${m.key}`,
      dueKey: due,
      userIds: [c.customer.ownerId, c.holderId],
      kind: m.kind,
      severity: m.severity,
      title: expiryTitle(m.label, credentialSubject(c), due, ctx.today),
      body: `Hạn ${c.type === 'DIGITAL_SIGNATURE' ? 'chứng thư số' : 'tài khoản'}: ${fmtDate(due)}. Cần gia hạn hoặc cập nhật ngày hết hạn trong kho tài khoản.`,
      link: link(c.id),
      email: m.email,
    },
  ];
}

function loanReminder(
  c: Prisma.ClientCredentialGetPayload<{ select: typeof SELECT }>,
  ctx: PlanContext,
): PlannedReminder[] {
  const due = c.loanDueAt!;
  const escalateFrom = loanEscalationDate(due, ctx);
  const window = (from: Date) =>
    ctx.today >= from && ctx.today <= addDays(from, CATCH_UP_DAYS);
  const escalate = window(escalateFrom);
  if (!escalate && !window(due)) return [];
  const subject = credentialSubject(c);
  return [
    {
      subjectType: 'CREDENTIAL',
      subjectId: c.id,
      milestone: escalate ? LOAN_ESCALATION : LOAN_DUE,
      dueKey: due,
      userIds: escalate ? [c.holderId, c.customer.ownerId] : [c.holderId],
      kind: escalate ? NotificationKind.ESCALATION : NotificationKind.OVERDUE,
      severity: escalate
        ? NotificationSeverity.DANGER
        : NotificationSeverity.WARNING,
      title: `${escalate ? 'Mượn token quá hạn trả' : 'Đến hạn trả token'}: ${subject}, hạn trả ${fmtDate(due)}`,
      body: 'Trả token về văn phòng và ghi nhận "Trả" trong kho tài khoản.',
      link: link(c.id),
      email: true,
    },
  ];
}

interface PendingDelivery {
  id: string;
  subjectId: string;
  milestone: string;
  dueKey: Date;
}

/**
 * I12 cho kho tài khoản: email chờ gửi không còn đúng — tài khoản đã xoá, hạn đã đổi (gia hạn chứng thư),
 * token đã trả hoặc đổi hạn trả. Trả id các dòng cần huỷ.
 */
export async function staleCredentialDeliveries(
  db: Db,
  pending: PendingDelivery[],
): Promise<string[]> {
  if (!pending.length) return [];
  const rows = await db.clientCredential.findMany({
    where: { id: { in: pending.map((p) => p.subjectId) } },
    select: {
      id: true,
      deletedAt: true,
      expiresAt: true,
      custody: true,
      loanDueAt: true,
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const same = (a: Date | null, b: Date) => a?.getTime() === b.getTime();
  return pending
    .filter((p) => {
      const c = byId.get(p.subjectId);
      if (!c || c.deletedAt) return true;
      if (p.milestone.startsWith(EXPIRY)) return !same(c.expiresAt, p.dueKey);
      return c.custody !== TokenCustody.LOANED || !same(c.loanDueAt, p.dueKey);
    })
    .map((p) => p.id);
}
