import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, toSkipTake } from '../../common/types/paginated';
import { xlsxWorkbook } from '../../common/types/xlsx-workbook';
import { contractScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PaymentQueryDto } from './dto/payment.dto';
import { PAYMENT_STATUS_LABEL } from './payment.rules';

const METHOD_LABEL = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản' };
const EXPORT_LIMIT = 10_000;
const dateVn = (d: Date | null) =>
  d ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : '';

export const PAYMENT_INCLUDE = {
  contract: {
    select: {
      id: true,
      code: true,
      customer: { select: { id: true, name: true } },
    },
  },
  installment: { select: { id: true, name: true } },
  receivedBy: { select: { id: true, fullName: true } },
  _count: { select: { documents: true } },
} satisfies Prisma.PaymentInclude;

/** Đọc phiếu thu (07) theo phạm vi HĐ của người dùng. Công nợ: `ReceivablesQueryService`. */
@Injectable()
export class PaymentsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, query: PaymentQueryDto) {
    const where = this.where(user, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        orderBy: [{ paidDate: 'desc' }, { code: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  /** Excel phiếu thu theo cùng bộ lọc với danh sách (07-D1, `payments:export`). */
  async exportPayments(user: AuthUser, query: PaymentQueryDto) {
    const rows = await this.prisma.payment.findMany({
      where: this.where(user, query),
      include: PAYMENT_INCLUDE,
      orderBy: [{ paidDate: 'desc' }, { code: 'desc' }],
      take: EXPORT_LIMIT + 1,
    });
    if (rows.length > EXPORT_LIMIT)
      throw new BadRequestException(
        'Tối đa 10.000 phiếu mỗi lần xuất. Vui lòng thu hẹp bộ lọc.',
      );
    return xlsxWorkbook(
      [
        [
          'Mã phiếu',
          'Ngày thu',
          'Mã HĐ',
          'Khách hàng',
          'Đợt',
          'Số tiền',
          'Hình thức',
          'Số chứng từ',
          'Trạng thái',
          'Người lập',
          'Ngày duyệt',
          'Ghi chú',
        ],
        ...rows.map((p) => [
          p.code,
          dateVn(p.paidDate),
          p.contract.code,
          p.contract.customer.name,
          p.installment?.name ?? '',
          p.amount.toNumber(),
          METHOD_LABEL[p.method],
          p.documentNumber ?? '',
          PAYMENT_STATUS_LABEL[p.status],
          p.receivedBy.fullName,
          dateVn(p.approvedAt),
          p.note ?? '',
        ]),
      ],
      'Phieu thu',
    );
  }

  private where(
    user: AuthUser,
    query: PaymentQueryDto,
  ): Prisma.PaymentWhereInput {
    const search = query.search?.trim();
    return {
      deletedAt: null,
      contractId: query.contractId,
      status: query.status,
      paidDate: {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      },
      contract: {
        AND: [
          contractScope(user),
          query.customerId ? { customerId: query.customerId } : {},
        ],
      },
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { documentNumber: { contains: search, mode: 'insensitive' } },
          { contract: { code: { contains: search, mode: 'insensitive' } } },
          {
            contract: {
              customer: { name: { contains: search, mode: 'insensitive' } },
            },
          },
        ],
      }),
    };
  }

  /** Chi tiết: phân bổ theo đợt, chứng từ, lịch sử (kèm tên người thao tác). */
  async findOne(user: AuthUser, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null, contract: contractScope(user) },
      include: {
        ...PAYMENT_INCLUDE,
        contract: {
          select: {
            id: true,
            code: true,
            total: true,
            customer: { select: { id: true, name: true } },
          },
        },
        allocations: {
          select: {
            amount: true,
            installment: { select: { id: true, name: true, dueDate: true } },
          },
        },
        documents: {
          select: {
            document: { select: { id: true, fileName: true, deletedAt: true } },
          },
        },
        events: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!payment) throw new NotFoundException('Không tìm thấy phiếu thu');
    const ids = [
      payment.approvedById,
      payment.cancelledById,
      ...payment.events.map((e) => e.actorId),
    ].filter((v): v is string => !!v);
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, fullName: true },
    });
    const name = (userId: string | null) =>
      users.find((u) => u.id === userId)?.fullName ?? null;
    const { documents, events, ...rest } = payment;
    return {
      ...rest,
      approvedByName: name(payment.approvedById),
      cancelledByName: name(payment.cancelledById),
      documents: documents
        .map((d) => d.document)
        .filter((d) => !d.deletedAt)
        .map(({ id: docId, fileName }) => ({ id: docId, fileName })),
      events: events.map((e) => ({ ...e, actorName: name(e.actorId) })),
    };
  }
}
