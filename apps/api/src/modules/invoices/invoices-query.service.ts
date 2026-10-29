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
import { InvoiceQueryDto } from './dto/invoice.dto';
import { INVOICE_KIND_LABEL, INVOICE_STATUS_LABEL } from './invoice.rules';

const EXPORT_LIMIT = 10_000;

export const INVOICE_INCLUDE = {
  contract: {
    select: {
      id: true,
      code: true,
      vatRate: true,
      customer: { select: { id: true, name: true, taxCode: true } },
    },
  },
  requestedBy: { select: { id: true, fullName: true } },
  installments: {
    select: {
      installment: { select: { id: true, name: true, dueDate: true } },
    },
  },
  _count: { select: { documents: true } },
} satisfies Prisma.InvoiceInclude;

const RELATED_SELECT = {
  id: true,
  kind: true,
  status: true,
  templateCode: true,
  symbol: true,
  number: true,
  issueDate: true,
  subtotal: true,
  total: true,
} satisfies Prisma.InvoiceSelect;

/** Đọc sổ hoá đơn (08) theo phạm vi HĐ của người dùng. */
@Injectable()
export class InvoicesQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, query: InvoiceQueryDto) {
    const where = this.where(user, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: [
          { issueDate: { sort: 'desc', nulls: 'first' } },
          { createdAt: 'desc' },
        ],
        ...toSkipTake(query),
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  /** Chi tiết: đợt, file PDF/XML, hoá đơn gốc / điều chỉnh / thay thế, lịch sử (kèm tên người thao tác). */
  async findOne(user: AuthUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        contract: { AND: [contractScope(user), { deletedAt: null }] },
      },
      include: {
        ...INVOICE_INCLUDE,
        related: { select: RELATED_SELECT },
        derived: { select: RELATED_SELECT, orderBy: { createdAt: 'asc' } },
        documents: {
          select: {
            document: {
              select: {
                id: true,
                fileName: true,
                mimeType: true,
                deletedAt: true,
              },
            },
          },
        },
        events: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!invoice) throw new NotFoundException('Không tìm thấy hoá đơn');
    const ids = [
      invoice.issuedById,
      ...invoice.events.map((e) => e.actorId),
    ].filter((v): v is string => !!v);
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, fullName: true },
    });
    const name = (userId: string | null) =>
      users.find((u) => u.id === userId)?.fullName ?? null;
    const { documents, events, ...rest } = invoice;
    return {
      ...rest,
      issuedByName: name(invoice.issuedById),
      documents: documents
        .map((d) => d.document)
        .filter((d) => !d.deletedAt)
        .map(({ id: docId, fileName, mimeType }) => ({
          id: docId,
          fileName,
          mimeType,
        })),
      events: events.map((e) => ({ ...e, actorName: name(e.actorId) })),
    };
  }

  /** Excel sổ hoá đơn theo cùng bộ lọc với danh sách (08-D, `invoices:export`); tiền là ô số. */
  async exportInvoices(user: AuthUser, query: InvoiceQueryDto) {
    const rows = await this.prisma.invoice.findMany({
      where: this.where(user, query),
      include: INVOICE_INCLUDE,
      orderBy: [
        { issueDate: { sort: 'desc', nulls: 'first' } },
        { createdAt: 'desc' },
      ],
      take: EXPORT_LIMIT + 1,
    });
    if (rows.length > EXPORT_LIMIT)
      throw new BadRequestException(
        'Tối đa 10.000 hoá đơn mỗi lần xuất. Vui lòng thu hẹp bộ lọc.',
      );
    return xlsxWorkbook(
      [
        [
          'Ký hiệu mẫu số',
          'Ký hiệu',
          'Số hoá đơn',
          'Ngày lập',
          'Loại',
          'Trạng thái',
          'Mã HĐ',
          'Người mua',
          'MST người mua',
          'Đợt',
          'Trước VAT',
          'VAT',
          'Tổng tiền',
          'Lý do',
        ],
        ...rows.map((i) => [
          i.templateCode ?? '',
          i.symbol ?? '',
          i.number ?? '',
          i.issueDate
            ? i.issueDate
                .toISOString()
                .slice(0, 10)
                .split('-')
                .reverse()
                .join('/')
            : '',
          INVOICE_KIND_LABEL[i.kind],
          INVOICE_STATUS_LABEL[i.status],
          i.contract.code,
          i.buyerName ?? i.contract.customer.name,
          i.buyerTaxCode ?? i.contract.customer.taxCode,
          i.installments.map((x) => x.installment.name).join(', '),
          i.subtotal.toNumber(),
          i.vatAmount.toNumber(),
          i.total.toNumber(),
          i.reason ?? '',
        ]),
      ],
      'So hoa don',
    );
  }

  where(user: AuthUser, query: InvoiceQueryDto): Prisma.InvoiceWhereInput {
    const search = query.search?.trim();
    return {
      status: query.status,
      kind: query.kind,
      contractId: query.contractId,
      issueDate: {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      },
      contract: {
        AND: [
          contractScope(user),
          { deletedAt: null },
          query.customerId ? { customerId: query.customerId } : {},
        ],
      },
      ...(search && {
        OR: [
          { number: { contains: search, mode: 'insensitive' } },
          { symbol: { contains: search, mode: 'insensitive' } },
          { buyerName: { contains: search, mode: 'insensitive' } },
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
}
