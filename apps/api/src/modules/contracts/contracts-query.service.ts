import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContractStatus,
  PaymentStatus,
  Prisma,
  TaskStatus,
} from '@prisma/client';
import { paginated, toSkipTake } from '../../common/types/paginated';
import { contractScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { paymentStatusOf, sumDecimal } from './contract-calculator';
import { installmentStates } from '../../common/receivables';
import {
  allocatedOf,
  balancesOf,
  contractReceivable,
  COUNTED_PAYMENT,
  INSTALLMENT_BALANCE_SELECT,
  RECEIVABLE_EXCLUDED,
} from '../payments/payment-allocation';
import { todayVn } from '../reports/utils/period.util';
import { ContractQueryDto } from './dto/contract.dto';

const USER_BRIEF = { select: { id: true, fullName: true } } as const;

const LIST_INCLUDE = {
  customer: { select: { id: true, name: true } },
  owner: USER_BRIEF,
  services: { select: { serviceType: { select: { id: true, name: true } } } },
  payments: { where: COUNTED_PAYMENT, select: { amount: true } },
  // 07-D2: trạng thái "Còn nợ quá hạn" theo quy tắc công nợ chung.
  installments: { select: INSTALLMENT_BALANCE_SELECT },
} satisfies Prisma.ContractInclude;

const DETAIL_INCLUDE = {
  customer: {
    select: {
      id: true,
      name: true,
      taxCode: true,
      address: true,
      ownerId: true,
    },
  },
  owner: USER_BRIEF,
  approvedBy: USER_BRIEF,
  renewedFrom: { select: { id: true, code: true } },
  renewals: {
    where: { deletedAt: null },
    select: { id: true, code: true, status: true },
  },
  services: {
    include: {
      serviceType: {
        select: {
          id: true,
          code: true,
          name: true,
          cycle: true,
          // 04-F: trang HĐ hiện tab Kiểm toán khi có dòng phát hành BCKT.
          issuesAuditReport: true,
        },
      },
      assignee: USER_BRIEF,
      plan: { select: { id: true, status: true } },
    },
  },
  installments: {
    orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
    include: { allocations: { select: { amount: true } } },
  },
  payments: {
    // 07 (J2): hiện cả phiếu chưa duyệt (kèm trạng thái); chỉ phiếu Đã duyệt tính đã thu.
    where: { deletedAt: null, status: { not: PaymentStatus.CANCELLED } },
    include: {
      receivedBy: USER_BRIEF,
      installment: { select: { id: true, name: true } },
    },
    orderBy: { paidDate: 'desc' },
  },
  invoices: {
    include: { requestedBy: USER_BRIEF },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.ContractInclude;

/** Điều kiện tìm hợp đồng trong phạm vi người dùng, chưa xoá. */
export function scopedContract(
  user: AuthUser,
  where: Prisma.ContractWhereInput,
): Prisma.ContractWhereInput {
  return { AND: [contractScope(user), { deletedAt: null }, where] };
}

@Injectable()
export class ContractsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, query: ContractQueryDto) {
    const search = query.search?.trim();
    const where = scopedContract(user, {
      status: query.status,
      customerId: query.customerId,
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { code: 'desc' },
        ...toSkipTake(query),
      }),
      this.prisma.contract.count({ where }),
    ]);
    const today = todayVn();
    const items = rows.map(({ services, payments, installments, ...c }) => {
      const { paid, overdueAmount } = contractReceivable(
        { total: c.total, installments, payments },
        today,
      );
      return {
        ...c,
        serviceTypes: [...new Set(services.map((s) => s.serviceType.name))],
        paidAmount: paid,
        paymentStatus: paymentStatusOf(
          c.total,
          paid,
          receivableOverdue(c.status, overdueAmount),
        ),
      };
    });
    return paginated(items, total, query);
  }

  async findOne(user: AuthUser, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: scopedContract(user, { id }),
      include: DETAIL_INCLUDE,
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');

    const [taskTotal, taskDone] = await this.prisma.$transaction([
      this.prisma.task.count({ where: { contractId: id, deletedAt: null } }),
      this.prisma.task.count({
        where: {
          contractId: id,
          deletedAt: null,
          status: TaskStatus.COMPLETED,
        },
      }),
    ]);
    // Người phụ trách kinh doanh/người huỷ lưu id (không khoá ngoại sang users), lấy tên ở đây.
    const people = await this.prisma.user.findMany({
      where: {
        id: {
          in: [contract.salesOwnerId, contract.cancelledById].filter(
            (v): v is string => !!v,
          ),
        },
      },
      select: { id: true, fullName: true },
    });
    const person = (userId: string | null) =>
      people.find((p) => p.id === userId) ?? null;
    const amountOf = (status: PaymentStatus) =>
      sumDecimal(
        contract.payments
          .filter((p) => p.status === status)
          .map((p) => p.amount),
      );
    const paidAmount = amountOf(PaymentStatus.APPROVED);
    const pendingAmount = amountOf(PaymentStatus.PENDING);
    const invoicedSubtotal = sumDecimal(
      contract.invoices
        .filter((i) => i.status !== 'CANCELLED')
        .map((i) => i.subtotal),
    );
    const approved = contract.payments.filter(
      (p) => p.status === PaymentStatus.APPROVED,
    );
    const today = todayVn();
    const { overdueAmount } = contractReceivable(
      { ...contract, payments: approved },
      today,
    );
    const states = installmentStates(balancesOf(contract.installments), today);
    return {
      ...contract,
      installments: contract.installments.map(
        ({ allocations, ...i }, index) => ({
          ...i,
          paidAmount: allocatedOf({ allocations }),
          // J10: đợt theo mốc BCKT chưa phát hành; số ngày quá hạn theo quy tắc chung.
          awaitingMilestone: states[index].dueInDays === null,
          overdueDays: states[index].overdueDays,
        }),
      ),
      paidAmount,
      pendingAmount,
      overdueAmount: receivableOverdue(contract.status, overdueAmount),
      remainingAmount: contract.total.sub(paidAmount),
      paymentStatus: paymentStatusOf(
        contract.total,
        paidAmount,
        receivableOverdue(contract.status, overdueAmount),
      ),
      invoicedSubtotal,
      taskProgress: { total: taskTotal, done: taskDone },
      salesOwner: person(contract.salesOwnerId),
      cancelledBy: person(contract.cancelledById),
    };
  }
}

/** HĐ chưa duyệt / huỷ chưa phát sinh công nợ → không tính quá hạn (J7, J12). */
function receivableOverdue(status: ContractStatus, overdue: Prisma.Decimal) {
  return RECEIVABLE_EXCLUDED.includes(status) ? new Prisma.Decimal(0) : overdue;
}
