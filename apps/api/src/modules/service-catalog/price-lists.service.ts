import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PricingBasis, Prisma } from '@prisma/client';
import { hasPermission } from '../../core/access-control/permissions';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  formatBusinessDate,
  todayVn,
  toBusinessDate,
} from '../reports/utils/period.util';
import { PriceListDto, PriceQuoteQueryDto } from './dto/price-list.dto';
import { priceListStatuses, quotePrice, tierError } from './price-list.util';

const WITH_TIERS = {
  tiers: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ServicePriceListInclude;

type PriceListWithTiers = Prisma.ServicePriceListGetPayload<{
  include: typeof WITH_TIERS;
}>;

const LOCKED_MESSAGE =
  'Bảng giá đã hoặc đang áp dụng không sửa/xoá được; hãy tạo bảng giá mới';

/** Bảng giá có ngày hiệu lực và báo giá theo bậc (đặc tả 03-A). Chỉ người có quyền tài chính. */
@Injectable()
export class PriceListsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, serviceTypeId: string, today = todayVn()) {
    this.ensureFinance(user);
    await this.findService(serviceTypeId);
    const lists = await this.prisma.servicePriceList.findMany({
      where: { serviceTypeId, deletedAt: null },
      include: WITH_TIERS,
      orderBy: { effectiveFrom: 'desc' },
    });
    const statuses = priceListStatuses(lists, today);
    return lists.map((list) => ({
      ...list,
      status: statuses.get(list.id),
      editable: list.effectiveFrom > today,
    }));
  }

  async create(
    user: AuthUser,
    serviceTypeId: string,
    dto: PriceListDto,
    today = todayVn(),
  ) {
    this.ensureFinance(user);
    const service = await this.findService(serviceTypeId);
    const effectiveFrom = this.checkContent(service.pricingBasis, dto, today);
    return this.write(async (tx) => {
      const created = await tx.servicePriceList.create({
        data: {
          serviceTypeId,
          effectiveFrom,
          pricingBasis: service.pricingBasis,
          pricingUnit: service.pricingUnit,
          note: dto.note?.trim() || null,
          createdById: user.id,
          tiers: { createMany: { data: tierRows(dto) } },
        },
        include: WITH_TIERS,
      });
      await audit(tx, user, 'PRICE_LIST_CREATE', serviceTypeId, null, created);
      return created;
    });
  }

  async update(
    user: AuthUser,
    serviceTypeId: string,
    id: string,
    dto: PriceListDto,
    today = todayVn(),
  ) {
    this.ensureFinance(user);
    const before = await this.findEditable(serviceTypeId, id, today);
    const effectiveFrom = this.checkContent(before.pricingBasis, dto, today);
    return this.write(async (tx) => {
      // Điều kiện ngày trong câu lệnh cập nhật chặn sửa khi bảng giá vừa đến ngày áp dụng.
      const { count } = await tx.servicePriceList.updateMany({
        where: { id, deletedAt: null, effectiveFrom: { gt: today } },
        data: { effectiveFrom, note: dto.note?.trim() || null },
      });
      if (count === 0) throw new ConflictException(LOCKED_MESSAGE);
      await tx.servicePriceTier.deleteMany({ where: { priceListId: id } });
      await tx.servicePriceTier.createMany({
        data: tierRows(dto).map((row) => ({ ...row, priceListId: id })),
      });
      const after = await tx.servicePriceList.findUniqueOrThrow({
        where: { id },
        include: WITH_TIERS,
      });
      await audit(tx, user, 'PRICE_LIST_UPDATE', serviceTypeId, before, after);
      return after;
    });
  }

  async remove(
    user: AuthUser,
    serviceTypeId: string,
    id: string,
    today = todayVn(),
  ) {
    this.ensureFinance(user);
    const before = await this.findEditable(serviceTypeId, id, today);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.servicePriceList.updateMany({
        where: { id, deletedAt: null, effectiveFrom: { gt: today } },
        data: { deletedAt: new Date() },
      });
      if (count === 0) throw new ConflictException(LOCKED_MESSAGE);
      await audit(tx, user, 'PRICE_LIST_DELETE', serviceTypeId, before, null);
      return { id };
    });
  }

  async quote(
    user: AuthUser,
    serviceTypeId: string,
    query: PriceQuoteQueryDto,
    today = todayVn(),
  ) {
    this.ensureFinance(user);
    const service = await this.findService(serviceTypeId);
    const date = query.date ? toBusinessDate(query.date) : today;
    const list = await this.prisma.servicePriceList.findFirst({
      where: { serviceTypeId, deletedAt: null, effectiveFrom: { lte: date } },
      include: WITH_TIERS,
      orderBy: { effectiveFrom: 'desc' },
    });
    if (list && list.pricingBasis !== PricingBasis.NONE && !query.value) {
      throw new BadRequestException(
        'Vui lòng nhập giá trị theo tiêu chí của bảng giá',
      );
    }
    const value = new Prisma.Decimal(query.value ?? 0);
    return {
      serviceTypeId,
      date: formatBusinessDate(date),
      value: query.value ?? null,
      ...quotePrice(service.defaultPrice, list ?? undefined, value),
    };
  }

  private ensureFinance(user: AuthUser) {
    if (!hasPermission(user, 'finance', 'view'))
      throw new ForbiddenException(
        'Bạn không có quyền truy cập dữ liệu tài chính',
      );
  }

  private async findService(id: string) {
    const service = await this.prisma.serviceType.findUnique({
      where: { id },
    });
    if (!service) throw new NotFoundException('Không tìm thấy dịch vụ');
    return service;
  }

  private async findEditable(serviceTypeId: string, id: string, today: Date) {
    const list = await this.prisma.servicePriceList.findFirst({
      where: { id, serviceTypeId, deletedAt: null },
      include: WITH_TIERS,
    });
    if (!list) throw new NotFoundException('Không tìm thấy bảng giá');
    if (list.effectiveFrom <= today)
      throw new ConflictException(LOCKED_MESSAGE);
    return list;
  }

  /** Kiểm tra ngày hiệu lực không trước hôm nay và các bậc liền mạch; trả về ngày đã chuẩn hoá. */
  private checkContent(basis: PricingBasis, dto: PriceListDto, today: Date) {
    const effectiveFrom = toBusinessDate(dto.effectiveFrom);
    if (effectiveFrom < today)
      throw new BadRequestException(
        'Ngày hiệu lực không được trước hôm nay để giữ nguyên lịch sử giá',
      );
    const error = tierError(basis, dto.tiers);
    if (error) throw new BadRequestException(error);
    return effectiveFrom;
  }

  private async write<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(fn);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      )
        throw new ConflictException('Đã có bảng giá áp dụng từ ngày này');
      throw err;
    }
  }
}

function tierRows(dto: PriceListDto) {
  return dto.tiers.map((tier, index) => ({
    sortOrder: index + 1,
    minValue: tier.minValue,
    maxValue: tier.maxValue ?? null,
    unitPrice: tier.unitPrice,
    note: tier.note?.trim() || null,
  }));
}

/** Tóm tắt bảng giá cho nhật ký: ngày, tiêu chí và các bậc [từ, đến, đơn giá]. */
function summary(list: PriceListWithTiers | null) {
  if (!list) return null;
  return {
    id: list.id,
    effectiveFrom: formatBusinessDate(list.effectiveFrom),
    pricingBasis: list.pricingBasis,
    tiers: list.tiers.map((t) => [
      t.minValue.toString(),
      t.maxValue?.toString() ?? null,
      t.unitPrice.toString(),
    ]),
  };
}

async function audit(
  tx: Prisma.TransactionClient,
  user: AuthUser,
  action: string,
  serviceTypeId: string,
  before: PriceListWithTiers | null,
  after: PriceListWithTiers | null,
) {
  await tx.auditLog.create({
    data: {
      userId: user.id,
      action,
      entity: 'service-types',
      entityId: serviceTypeId,
      detail: { before: summary(before), after: summary(after) },
    },
  });
}
