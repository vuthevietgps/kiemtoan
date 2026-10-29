import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { paginated, toSkipTake } from '../../common/types/paginated';
import { contractScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { sumDecimal, vatOf } from '../contracts/contract-calculator';
import { NOT_BILLABLE_STATUSES } from '../contracts/contracts.constants';
import {
  CreateInvoiceDto,
  InvoiceQueryDto,
  IssueInvoiceDto,
} from './dto/invoice.dto';

const INVOICE_INCLUDE = {
  contract: {
    select: {
      id: true,
      code: true,
      vatRate: true,
      customer: { select: { id: true, name: true, taxCode: true } },
    },
  },
  requestedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, query: InvoiceQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.InvoiceWhereInput = {
      status: query.status,
      contractId: query.contractId,
      contract: { AND: [contractScope(user), { deletedAt: null }] },
      ...(search && {
        OR: [
          { number: { contains: search, mode: 'insensitive' } },
          { contract: { code: { contains: search, mode: 'insensitive' } } },
          {
            contract: {
              customer: { name: { contains: search, mode: 'insensitive' } },
            },
          },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(query),
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  /** Đề nghị xuất hoá đơn; mặc định bằng phần giá trị hợp đồng chưa xuất hoá đơn. */
  async create(user: AuthUser, dto: CreateInvoiceDto) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        AND: [contractScope(user), { id: dto.contractId, deletedAt: null }],
      },
      include: {
        invoices: {
          where: { status: { not: InvoiceStatus.CANCELLED } },
          select: { subtotal: true },
        },
      },
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    if (NOT_BILLABLE_STATUSES.includes(contract.status)) {
      throw new BadRequestException(
        'Hợp đồng nháp hoặc đã huỷ không thể xuất hoá đơn',
      );
    }
    const remaining = contract.subtotal.sub(
      sumDecimal(contract.invoices.map((i) => i.subtotal)),
    );
    const subtotal = dto.subtotal
      ? new Prisma.Decimal(dto.subtotal)
      : remaining;
    if (subtotal.lte(0)) {
      throw new BadRequestException(
        dto.subtotal
          ? 'Giá trị hoá đơn phải lớn hơn 0'
          : 'Hợp đồng đã xuất đủ hoá đơn',
      );
    }
    if (subtotal.gt(remaining)) {
      throw new BadRequestException(
        'Giá trị hoá đơn vượt quá phần chưa xuất hoá đơn của hợp đồng',
      );
    }
    const vatAmount = vatOf(subtotal, contract.vatRate);
    return this.prisma.invoice.create({
      data: {
        contractId: contract.id,
        subtotal,
        vatAmount,
        total: subtotal.add(vatAmount),
        note: dto.note,
        requestedById: user.id,
      },
      include: INVOICE_INCLUDE,
    });
  }

  async issue(user: AuthUser, id: string, dto: IssueInvoiceDto) {
    const invoice = await this.findScoped(user, id);
    if (invoice.status !== InvoiceStatus.REQUESTED) {
      throw new BadRequestException('Chỉ phát hành được hoá đơn đang đề nghị');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: {
        number: dto.number.trim(),
        symbol: dto.symbol.trim(),
        issueDate: new Date(dto.issueDate),
        status: InvoiceStatus.ISSUED,
      },
      include: INVOICE_INCLUDE,
    });
  }

  async cancel(user: AuthUser, id: string) {
    const invoice = await this.findScoped(user, id);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Hoá đơn đã bị huỷ');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
      include: INVOICE_INCLUDE,
    });
  }

  private async findScoped(user: AuthUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        contract: { AND: [contractScope(user), { deletedAt: null }] },
      },
    });
    if (!invoice) throw new NotFoundException('Không tìm thấy hoá đơn');
    return invoice;
  }
}
