import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PricingBasis, Prisma, Role } from '@prisma/client';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PriceListsService } from './price-lists.service';

const TODAY = new Date('2026-10-15T00:00:00.000Z');
const TIERS = [
  { minValue: '0', maxValue: '100', unitPrice: '1000000' },
  { minValue: '100', maxValue: null, unitPrice: '2000000' },
];

describe('PriceListsService', () => {
  let service: PriceListsService;
  const tx = {
    servicePriceList: { create: jest.fn(), updateMany: jest.fn() },
    servicePriceTier: { deleteMany: jest.fn(), createMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    serviceType: { findUnique: jest.fn() },
    servicePriceList: { findFirst: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const director: AuthUser = {
    id: 'd1',
    email: 'd@test.vn',
    fullName: 'D',
    role: Role.DIRECTOR,
    teamId: null,
  };
  const staff: AuthUser = { ...director, id: 's1', role: Role.STAFF };
  const tieredService = {
    id: 'svc',
    defaultPrice: new Prisma.Decimal(500000),
    pricingBasis: PricingBasis.DOCUMENT_COUNT,
    pricingUnit: 'chứng từ',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.serviceType.findUnique.mockResolvedValue(tieredService);
    const moduleRef = await Test.createTestingModule({
      providers: [
        PriceListsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(PriceListsService);
  });

  it('người không có quyền tài chính bị chặn trước khi đọc dữ liệu', async () => {
    await expect(service.list(staff, 'svc', TODAY)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.quote(staff, 'svc', { value: '10' }, TODAY),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.servicePriceList.findMany).not.toHaveBeenCalled();
    expect(prisma.servicePriceList.findFirst).not.toHaveBeenCalled();
  });

  it('không cho tạo bảng giá có ngày hiệu lực trước hôm nay', async () => {
    await expect(
      service.create(
        director,
        'svc',
        { effectiveFrom: '2026-10-14', tiers: TIERS },
        TODAY,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.servicePriceList.create).not.toHaveBeenCalled();
  });

  it('tạo bảng giá chụp tiêu chí của dịch vụ và ghi nhật ký', async () => {
    tx.servicePriceList.create.mockResolvedValue({
      id: 'pl1',
      effectiveFrom: TODAY,
      pricingBasis: PricingBasis.DOCUMENT_COUNT,
      tiers: [],
    });
    await service.create(
      director,
      'svc',
      { effectiveFrom: '2026-10-15', tiers: TIERS },
      TODAY,
    );
    const args = (
      tx.servicePriceList.create.mock.calls as unknown[][]
    )[0][0] as {
      data: { pricingBasis: PricingBasis; pricingUnit: string };
    };
    expect(args.data).toMatchObject({
      pricingBasis: PricingBasis.DOCUMENT_COUNT,
      pricingUnit: 'chứng từ',
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRICE_LIST_CREATE',
        }) as unknown,
      }),
    );
  });

  it('trùng ngày hiệu lực (unique) trả 409', async () => {
    tx.servicePriceList.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.create(
        director,
        'svc',
        { effectiveFrom: '2026-10-20', tiers: TIERS },
        TODAY,
      ),
    ).rejects.toThrow(
      new ConflictException('Đã có bảng giá áp dụng từ ngày này'),
    );
  });

  it('bảng giá đang áp dụng không sửa/xoá được', async () => {
    prisma.servicePriceList.findFirst.mockResolvedValue({
      id: 'pl1',
      effectiveFrom: TODAY,
      pricingBasis: PricingBasis.DOCUMENT_COUNT,
      tiers: [],
    });
    const dto = { effectiveFrom: '2026-10-20', tiers: TIERS };
    await expect(
      service.update(director, 'svc', 'pl1', dto, TODAY),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.remove(director, 'svc', 'pl1', TODAY),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.servicePriceList.updateMany).not.toHaveBeenCalled();
  });

  it('bảng giá vừa đến ngày áp dụng giữa lúc sửa thì không ghi (409)', async () => {
    prisma.servicePriceList.findFirst.mockResolvedValue({
      id: 'pl1',
      effectiveFrom: new Date('2026-10-20T00:00:00.000Z'),
      pricingBasis: PricingBasis.DOCUMENT_COUNT,
      tiers: [],
    });
    tx.servicePriceList.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update(
        director,
        'svc',
        'pl1',
        { effectiveFrom: '2026-10-21', tiers: TIERS },
        TODAY,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.servicePriceTier.deleteMany).not.toHaveBeenCalled();
  });

  it('báo giá theo bậc bắt buộc nhập giá trị', async () => {
    prisma.servicePriceList.findFirst.mockResolvedValue({
      id: 'pl1',
      effectiveFrom: TODAY,
      pricingBasis: PricingBasis.DOCUMENT_COUNT,
      pricingUnit: null,
      tiers: [],
    });
    await expect(
      service.quote(director, 'svc', {}, TODAY),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
