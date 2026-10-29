import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CONTRACT_APPROVED } from '../../common/events/app-events';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ContractsApprovalService } from './contracts-approval.service';

const dec = (v: string) => new Prisma.Decimal(v);

describe('ContractsApprovalService', () => {
  let service: ContractsApprovalService;
  const tx = {
    contract: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    contract: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const events = { emit: jest.fn(), emitAsync: jest.fn() };
  const director: AuthUser = {
    id: 'd1',
    email: 'gd@demo.vn',
    fullName: 'Giám đốc',
    role: 'DIRECTOR',
    teamId: null,
  };
  const contract = (status: string, extra: object = {}) => ({
    id: 'c1',
    code: 'HD-2025-001',
    status,
    total: dec('110000000'),
    services: [
      {
        id: 's1',
        taskGenerationStatus: 'PENDING',
        serviceType: { code: 'KTT', isActive: true },
      },
    ],
    installments: [{ amount: dec('110000000') }],
    ...extra,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    tx.contract.updateMany.mockResolvedValue({ count: 1 });
    tx.contract.findUniqueOrThrow.mockResolvedValue({
      id: 'c1',
      code: 'HD-2025-001',
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ContractsApprovalService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = moduleRef.get(ContractsApprovalService);
  });

  it('duyệt hợp đồng: ghi nhật ký APPROVE và phát sự kiện', async () => {
    prisma.contract.findFirst.mockResolvedValue(contract('PENDING_APPROVAL'));
    await service.approve(director, 'c1');
    expect(tx.contract.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'c1',
          status: 'PENDING_APPROVAL',
        }) as unknown,
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'd1',
        action: 'APPROVE',
        entity: 'contracts',
        entityId: 'c1',
        detail: expect.objectContaining({ code: 'HD-2025-001' }) as unknown,
      }) as unknown,
    });
    expect(events.emitAsync).toHaveBeenCalledWith(CONTRACT_APPROVED, {
      contractId: 'c1',
      approvedById: 'd1',
    });
  });

  it('không duyệt lại hợp đồng đã duyệt', async () => {
    prisma.contract.findFirst.mockResolvedValue(contract('IN_PROGRESS'));
    await expect(service.approve(director, 'c1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('bấm duyệt lại hợp đồng vừa được duyệt trả 409', async () => {
    prisma.contract.findFirst.mockResolvedValue(
      contract('NOT_STARTED', { approvedAt: new Date() }),
    );
    await expect(service.approve(director, 'c1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('không duyệt thẳng từ Nháp (E3)', async () => {
    prisma.contract.findFirst.mockResolvedValue(contract('DRAFT'));
    await expect(service.approve(director, 'c1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.contract.updateMany).not.toHaveBeenCalled();
  });

  it('người khác vừa đổi trạng thái thì trả 409, không phát sự kiện', async () => {
    prisma.contract.findFirst.mockResolvedValue(contract('PENDING_APPROVAL'));
    tx.contract.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.approve(director, 'c1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(events.emitAsync).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('gửi duyệt chặn HĐ không có dịch vụ, dịch vụ ngừng, đợt thanh toán lệch tổng', async () => {
    prisma.contract.findFirst.mockResolvedValue(
      contract('DRAFT', { services: [] }),
    );
    await expect(service.submit(director, 'c1')).rejects.toThrow(
      'Hợp đồng cần ít nhất một dòng dịch vụ',
    );
    prisma.contract.findFirst.mockResolvedValue(
      contract('DRAFT', {
        services: [{ id: 's1', serviceType: { code: 'OLD', isActive: false } }],
      }),
    );
    await expect(service.submit(director, 'c1')).rejects.toThrow(
      /OLD đã ngừng cung cấp/,
    );
    prisma.contract.findFirst.mockResolvedValue(
      contract('DRAFT', { installments: [{ amount: dec('1') }] }),
    );
    await expect(service.submit(director, 'c1')).rejects.toThrow(
      /Tổng các đợt thanh toán/,
    );
    expect(tx.contract.updateMany).not.toHaveBeenCalled();
  });

  it('trả lại lưu lý do và ghi nhật ký RETURN', async () => {
    prisma.contract.findFirst.mockResolvedValue(contract('PENDING_APPROVAL'));
    await service.returnToDraft(director, 'c1', 'Sai đơn giá dòng 2');
    const args = (tx.contract.updateMany.mock.calls as unknown[][])[0][0] as {
      data: { status: string; returnedReason: string };
    };
    expect(args.data).toMatchObject({
      status: 'DRAFT',
      returnedReason: 'Sai đơn giá dòng 2',
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'RETURN',
        detail: expect.objectContaining({
          reason: 'Sai đơn giá dòng 2',
        }) as unknown,
      }) as unknown,
    });
  });

  it('không sinh lại khi mọi dòng đã sinh việc', async () => {
    prisma.contract.findFirst.mockResolvedValue(
      contract('NOT_STARTED', {
        services: [
          {
            id: 's1',
            taskGenerationStatus: 'DONE',
            serviceType: { code: 'KTT', isActive: true },
          },
        ],
      }),
    );
    await expect(
      service.regenerateTasks(director, 'c1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(events.emitAsync).not.toHaveBeenCalled();
  });
});
