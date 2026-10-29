import { Injectable } from '@nestjs/common';
import {
  AcceptanceStatus,
  AuditStage,
  ClientDeliveryStatus,
  ContractStatus,
  InvoiceStatus,
  OriginalFilingStatus,
  Prisma,
  TaskPriority,
} from '@prisma/client';
import { hasPermission } from '../../../core/access-control/permissions';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { COUNTED_PAYMENT } from '../../payments/payment-allocation';
import { scopedContract } from '../contracts-query.service';
import { AuditBoardQueryDto } from '../dto/audit-engagement.dto';
import { vietnamToday } from '../lifecycle/renewal.util';
import { auditYear, STAGE_ORDER } from './audit-engagement.rules';
import { evaluateDeadline } from './deadline.rules';

const LINE_SELECT = {
  id: true,
  period: true,
  amount: true,
  serviceType: { select: { id: true, code: true, name: true } },
  contract: {
    select: {
      id: true,
      code: true,
      status: true,
      signedDate: true,
      startDate: true,
      total: true,
      owner: { select: { id: true, fullName: true } },
      customer: { select: { id: true, name: true, taxCode: true } },
      clientDeliveryStatus: true,
      originalFilingStatus: true,
      acceptanceStatus: true,
      invoices: {
        where: { status: { not: InvoiceStatus.CANCELLED } },
        select: { status: true },
      },
    },
  },
  audit: {
    select: {
      stage: true,
      priority: true,
      managerId: true,
      leadId: true,
      signer1Id: true,
      signer2Id: true,
      reportNumber: true,
      reportDate: true,
      members: { select: { userId: true }, orderBy: { sortOrder: 'asc' } },
      // Dòng báo cáo tình hình mới nhất (04-F4).
      notes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, createdAt: true, authorId: true },
      },
      deadlines: {
        select: {
          kind: true,
          originalDue: true,
          currentDue: true,
          achievedAt: true,
        },
      },
    },
  },
} satisfies Prisma.ContractServiceSelect;

type Line = Prisma.ContractServiceGetPayload<{ select: typeof LINE_SELECT }>;
type Row = ReturnType<typeof toRow>;

/** Thứ tự mức độ để sắp xếp (04-F4). */
const PRIORITY_ORDER: TaskPriority[] = [
  TaskPriority.LOW,
  TaskPriority.NORMAL,
  TaskPriority.HIGH,
  TaskPriority.URGENT,
];

const day = (date: Date | null | undefined) =>
  date ? date.toISOString().slice(0, 10) : null;

/**
 * Bảng theo dõi HĐ kiểm toán (đặc tả 04-F3). Lọc ở DB các điều kiện đơn giản, phần suy ra (năm,
 * tình trạng hạn, hồ sơ chưa đủ, hoá đơn, công nợ) lọc trong bộ nhớ rồi mới phân trang — đủ cho số
 * hồ sơ kiểm toán một công ty mỗi năm. Trường tiền mang tên trong FINANCIAL_KEYS để bị ẩn khi thiếu quyền.
 */
@Injectable()
export class AuditBoardQuery {
  constructor(private readonly prisma: PrismaService) {}

  async board(user: AuthUser, query: AuditBoardQueryDto) {
    const finance = hasPermission(user, 'finance', 'view');
    const lines = await this.prisma.contractService.findMany({
      where: this.where(user, query),
      select: LINE_SELECT,
    });
    const paid = finance
      ? await this.paidByContract(lines)
      : new Map<string, Prisma.Decimal>();
    const today = vietnamToday();
    let rows = lines.map((line) =>
      toRow(line, today, paid.get(line.contract.id)),
    );
    rows = rows.filter((r) => matches(r, query, finance));
    rows.sort(comparator(query));
    const page = rows.slice(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize,
    );
    const users = await this.userNames(page);
    return {
      items: page.map((r) => present(r, users, finance)),
      total: rows.length,
      page: query.page,
      pageSize: query.pageSize,
      summary: summary(rows, finance),
    };
  }

  private where(
    user: AuthUser,
    q: AuditBoardQueryDto,
  ): Prisma.ContractServiceWhereInput {
    const search = q.search?.trim();
    const contains = (value: string) => ({
      contains: value,
      mode: 'insensitive' as const,
    });
    const audit: Prisma.AuditEngagementWhereInput = {
      ...(q.managerId && { managerId: q.managerId }),
      ...(q.leadId && { leadId: q.leadId }),
      ...(q.signerId && {
        OR: [{ signer1Id: q.signerId }, { signer2Id: q.signerId }],
      }),
      ...(q.stage && q.stage !== AuditStage.NOT_STARTED && { stage: q.stage }),
    };
    const and: Prisma.ContractServiceWhereInput[] = [
      { serviceType: { issuesAuditReport: true } },
      {
        contract: scopedContract(user, {
          status: { not: ContractStatus.CANCELLED },
          ...(q.ownerId && { ownerId: q.ownerId }),
        }),
      },
    ];
    if (q.serviceTypeId) and.push({ serviceTypeId: q.serviceTypeId });
    if (Object.keys(audit).length) and.push({ audit });
    if (q.stage === AuditStage.NOT_STARTED)
      and.push({
        OR: [{ audit: null }, { audit: { stage: AuditStage.NOT_STARTED } }],
      });
    if (search)
      and.push({
        OR: [
          { contract: { code: contains(search) } },
          { contract: { customer: { name: contains(search) } } },
          { contract: { customer: { taxCode: contains(search) } } },
          { audit: { reportNumber: contains(search) } },
        ],
      });
    return { AND: and };
  }

  private async paidByContract(lines: Line[]) {
    const ids = [...new Set(lines.map((l) => l.contract.id))];
    const sums = await this.prisma.payment.groupBy({
      by: ['contractId'],
      where: { contractId: { in: ids }, ...COUNTED_PAYMENT },
      _sum: { amount: true },
    });
    return new Map(
      sums.map((s) => [s.contractId, s._sum.amount ?? new Prisma.Decimal(0)]),
    );
  }

  private async userNames(rows: Row[]) {
    const ids = new Set<string>();
    for (const r of rows)
      for (const id of [
        r.managerId,
        r.leadId,
        r.signer1Id,
        r.signer2Id,
        r.lastNote?.authorId,
        ...r.assistantIds,
      ])
        if (id) ids.add(id);
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u]));
  }
}

function toRow(line: Line, today: Date, paid?: Prisma.Decimal) {
  const a = line.audit;
  const deadlines = (a?.deadlines ?? []).map((d) => ({
    ...d,
    ...evaluateDeadline(d, today),
  }));
  const results = new Set(deadlines.map((d) => d.current.result));
  const issue = deadlines.find((d) => d.kind === 'REPORT_ISSUE');
  const c = line.contract;
  const paidAmount = paid ?? new Prisma.Decimal(0);
  const remaining = Prisma.Decimal.max(c.total.sub(paidAmount), 0);
  const invoice = c.invoices.some((i) => i.status === InvoiceStatus.ISSUED)
    ? 'ISSUED'
    : c.invoices.length
      ? 'REQUESTED'
      : 'NONE';
  return {
    line,
    stage: a?.stage ?? AuditStage.NOT_STARTED,
    priority: a?.priority ?? TaskPriority.NORMAL,
    lastNote: a?.notes[0] ?? null,
    year: auditYear(line.period, c.startDate),
    managerId: a?.managerId ?? null,
    leadId: a?.leadId ?? null,
    signer1Id: a?.signer1Id ?? null,
    signer2Id: a?.signer2Id ?? null,
    assistantIds: (a?.members ?? []).map((m) => m.userId),
    issue,
    flags: {
      overdue: results.has('OVERDUE'),
      dueSoon: results.has('DUE_SOON'),
      late: results.has('LATE'),
      extended: deadlines.some((d) => d.extended),
    },
    dossierIncomplete:
      c.clientDeliveryStatus === ClientDeliveryStatus.NOT_SENT ||
      c.originalFilingStatus !== OriginalFilingStatus.FILED ||
      c.acceptanceStatus !== AcceptanceStatus.SIGNED,
    invoice,
    paidAmount,
    remaining,
  };
}

function matches(r: Row, q: AuditBoardQueryDto, finance: boolean) {
  if (q.year && r.year !== q.year) return false;
  if (q.priority && r.priority !== q.priority) return false;
  if (q.deadline === 'OVERDUE' && !r.flags.overdue) return false;
  if (q.deadline === 'DUE_SOON' && !r.flags.dueSoon) return false;
  if (q.deadline === 'LATE' && !r.flags.late) return false;
  if (q.deadline === 'EXTENDED' && !r.flags.extended) return false;
  if (q.dossierIncomplete && !r.dossierIncomplete) return false;
  if (q.uninvoiced && !(r.stage === AuditStage.ISSUED && r.invoice === 'NONE'))
    return false;
  if (q.receivable && finance && r.remaining.lte(0)) return false;
  return true;
}

function comparator(q: AuditBoardQueryDto) {
  const sign = (q.order ?? (q.sort ? 'asc' : 'desc')) === 'asc' ? 1 : -1;
  const time = (d: Date | null | undefined) => d?.getTime() ?? null;
  const key = (r: Row): number | string | null => {
    switch (q.sort ?? 'signedDate') {
      case 'code':
        return r.line.contract.code;
      case 'stage':
        return STAGE_ORDER.indexOf(r.stage);
      case 'priority':
        return PRIORITY_ORDER.indexOf(r.priority);
      case 'issueDue':
        return time(r.issue?.currentDue);
      case 'reportDate':
        return time(r.line.audit?.reportDate);
      default:
        return time(r.line.contract.signedDate);
    }
  };
  return (x: Row, y: Row) => {
    const a = key(x);
    const b = key(y);
    if (a === b)
      return x.line.contract.code.localeCompare(y.line.contract.code);
    if (a === null) return 1; // thiếu giá trị luôn ở cuối
    if (b === null) return -1;
    return (a < b ? -1 : 1) * sign;
  };
}

function present(
  r: Row,
  users: Map<string, { id: string; fullName: string }>,
  finance: boolean,
) {
  const ref = (id: string | null) => (id && users.get(id)) || null;
  const c = r.line.contract;
  return {
    lineId: r.line.id,
    contract: {
      id: c.id,
      code: c.code,
      status: c.status,
      signedDate: day(c.signedDate),
      owner: c.owner,
    },
    customer: c.customer,
    year: r.year,
    serviceType: r.line.serviceType,
    period: r.line.period,
    stage: r.stage,
    priority: r.priority,
    lastNote: r.lastNote && {
      content: r.lastNote.content,
      createdAt: r.lastNote.createdAt,
      author: ref(r.lastNote.authorId),
    },
    manager: ref(r.managerId),
    lead: ref(r.leadId),
    assistants: r.assistantIds.map(ref).filter((u) => !!u),
    signer1: ref(r.signer1Id),
    signer2: ref(r.signer2Id),
    reportNumber: r.line.audit?.reportNumber ?? null,
    reportDate: day(r.line.audit?.reportDate),
    issueDeadline: r.issue
      ? {
          currentDue: day(r.issue.currentDue),
          originalDue: day(r.issue.originalDue),
          result: r.issue.current.result,
          days: r.issue.current.days,
          extended: r.issue.extended,
        }
      : null,
    deadlineFlags: r.flags,
    dossier: {
      clientDeliveryStatus: c.clientDeliveryStatus,
      originalFilingStatus: c.originalFilingStatus,
      acceptanceStatus: c.acceptanceStatus,
    },
    invoice: r.invoice,
    ...(finance && {
      amount: r.line.amount,
      totalContractValue: c.total,
      paidAmount: r.paidAmount,
      remainingAmount: r.remaining,
    }),
  };
}

/** Thẻ đếm theo bộ lọc; tiền tính trên các HĐ khác nhau, không cộng trùng HĐ nhiều dòng. */
function summary(rows: Row[], finance: boolean) {
  const byStage = Object.fromEntries(
    STAGE_ORDER.map((s) => [s, rows.filter((r) => r.stage === s).length]),
  );
  const contracts = new Map(rows.map((r) => [r.line.contract.id, r]));
  const sum = (pick: (r: Row) => Prisma.Decimal) =>
    [...contracts.values()].reduce(
      (acc, r) => acc.add(pick(r)),
      new Prisma.Decimal(0),
    );
  return {
    total: rows.length,
    byStage,
    overdue: rows.filter((r) => r.flags.overdue).length,
    dueSoon: rows.filter((r) => r.flags.dueSoon).length,
    ...(finance && {
      totalContractValue: sum((r) => r.line.contract.total),
      paidAmount: sum((r) => r.paidAmount),
      remainingAmount: sum((r) => r.remaining),
    }),
  };
}
