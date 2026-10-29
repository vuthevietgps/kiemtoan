import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AmendmentStatus,
  Contract,
  ContractStatus,
  InstallmentDueRule,
  PaymentInstallment,
  Prisma,
} from '@prisma/client';
import {
  CONTRACT_CANCELLED,
  ContractCancelledEvent,
} from '../../common/events/app-events';
import { customerScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  computeTotals,
  formatCode,
  nextSequence,
  sumDecimal,
} from './contract-calculator';
import {
  canTransition,
  DEFAULT_INSTALLMENT_DAYS,
  EDITABLE_STATUSES,
} from './contracts.constants';
import { syncMilestoneDues } from '../payments/installment-milestone';
import { reallocateContract } from '../payments/payment-allocation';
import { scopedContract } from './contracts-query.service';
import {
  ChangeableStatus,
  ContractServiceLineDto,
  CreateContractDto,
  InstallmentDto,
  UpdateContractDto,
} from './dto/contract.dto';

const DAY_MS = 86_400_000;

interface ContractContent {
  totals: {
    subtotal: Prisma.Decimal;
    vatAmount: Prisma.Decimal;
    total: Prisma.Decimal;
  };
  services: Prisma.ContractServiceCreateManyContractInput[];
  installments: Prisma.PaymentInstallmentCreateManyContractInput[];
}

@Injectable()
export class ContractsCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** `renewedFromId`: HĐ tái ký từ HĐ gốc (04-D); chỉ một HĐ tái ký còn hiệu lực (ràng buộc DB). */
  async create(
    user: AuthUser,
    dto: CreateContractDto,
    renewedFromId?: string,
  ): Promise<Contract> {
    await this.ensureCustomer(user, dto.customerId);
    await this.ensureReferences(dto.services, dto.ownerId, dto.salesOwnerId);
    const vatRate = dto.vatRate ?? 10;
    await this.ensureMilestoneRule(dto.services, dto.installments);
    const content = this.buildContent(
      dto.services,
      vatRate,
      dto.installments,
      dto.startDate,
    );
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.contract.create({
          data: {
            code: await this.nextCode(),
            customerId: dto.customerId,
            ownerId: dto.ownerId ?? user.id,
            signedDate: dto.signedDate ? new Date(dto.signedDate) : null,
            startDate: new Date(dto.startDate),
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            vatRate,
            note: dto.note,
            ...businessFields(dto),
            renewedFromId,
            ...content.totals,
            services: { createMany: { data: content.services } },
            installments: { createMany: { data: content.installments } },
          },
        });
      } catch (err) {
        // Hai người tạo cùng lúc trùng mã: lấy lại số tiếp theo.
        const duplicate =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002';
        if (duplicate && JSON.stringify(err.meta ?? {}).includes('renew'))
          throw new ConflictException('Hợp đồng này đã được tái ký');
        if (!duplicate || attempt >= 3) throw err;
      }
    }
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateContractDto,
  ): Promise<Contract> {
    const current = await this.prisma.contract.findFirst({
      where: scopedContract(user, { id }),
      include: { services: true, installments: true, payments: true },
    });
    if (!current) throw new NotFoundException('Không tìm thấy hợp đồng');
    if (!EDITABLE_STATUSES.includes(current.status)) {
      throw new BadRequestException(
        'Chỉ sửa được hợp đồng ở trạng thái Nháp hoặc Chờ duyệt',
      );
    }
    if (dto.customerId) await this.ensureCustomer(user, dto.customerId);
    await this.checkUpdateReferences(dto);

    const vatRate = dto.vatRate ?? current.vatRate.toNumber();
    const startDate = dto.startDate ?? toDateString(current.startDate);
    const lines: ContractServiceLineDto[] =
      dto.services ??
      current.services.map((s) => ({
        serviceTypeId: s.serviceTypeId,
        description: s.description ?? undefined,
        period: s.period ?? undefined,
        quantity: s.quantity,
        unitPrice: s.unitPrice.toString(),
        assigneeId: s.assigneeId ?? undefined,
      }));
    const newTotal = computeTotals(lines, vatRate).total;
    // Giữ các đợt cũ nếu không gửi đợt mới và tổng vẫn khớp; ngược lại tạo lại 1 đợt mặc định.
    const keepOld = sumDecimal(current.installments.map((i) => i.amount)).eq(
      newTotal,
    );
    const installments =
      dto.installments ??
      (keepOld ? current.installments.map(toInstallmentDto) : undefined);
    await this.ensureMilestoneRule(lines, installments);
    const content = this.buildContent(lines, vatRate, installments, startDate);
    const paid = sumDecimal(
      current.payments.filter((p) => !p.deletedAt).map((p) => p.amount),
    );
    if (paid.gt(content.totals.total)) {
      throw new BadRequestException(
        'Tổng giá trị hợp đồng không được nhỏ hơn số tiền đã thu',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { contractId: id },
        data: { installmentId: null },
      });
      await tx.contractService.deleteMany({ where: { contractId: id } });
      await tx.paymentInstallment.deleteMany({ where: { contractId: id } });
      const updated = await tx.contract.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          ownerId: dto.ownerId,
          signedDate: toOptionalDate(dto.signedDate),
          startDate: new Date(startDate),
          endDate: toOptionalDate(dto.endDate),
          vatRate,
          note: dto.note,
          ...businessFields(dto),
          ...content.totals,
          services: { createMany: { data: content.services } },
          installments: { createMany: { data: content.installments } },
        },
      });
      // 07 (J4): đợt tạo lại → phân bổ lại phiếu đã thu; J10: hạn theo mốc BCKT.
      await reallocateContract(tx, id);
      await syncMilestoneDues(tx, id);
      return updated;
    });
  }

  async changeStatus(
    user: AuthUser,
    id: string,
    status: ChangeableStatus,
    reason?: string,
  ): Promise<Contract> {
    const contract = await this.findScoped(user, id);
    if (!canTransition(contract.status, status)) {
      throw new BadRequestException(
        'Không thể chuyển hợp đồng sang trạng thái này',
      );
    }
    if (status === ContractStatus.CANCELLED)
      return this.cancel(user, contract, reason);
    return this.prisma.contract.update({ where: { id }, data: { status } });
  }

  /**
   * Huỷ HĐ (04-D): đã có việc thì bắt buộc lý do. 04 không tự xoá/đổi việc — phát sự kiện
   * `contract.cancelled` để 05 chuyển việc chưa bắt đầu sang huỷ; việc đã làm giữ nguyên lịch sử.
   */
  private async cancel(user: AuthUser, contract: Contract, reason?: string) {
    const taskCount = await this.prisma.task.count({
      where: { contractId: contract.id, deletedAt: null },
    });
    if (taskCount > 0 && !reason)
      throw new BadRequestException(
        'Hợp đồng đã có công việc: vui lòng nhập lý do huỷ',
      );
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.contract.updateMany({
        where: { id: contract.id, status: contract.status, deletedAt: null },
        data: {
          status: ContractStatus.CANCELLED,
          cancelReason: reason ?? null,
          cancelledAt: new Date(),
          cancelledById: user.id,
        },
      });
      if (!count)
        throw new ConflictException(
          'Hợp đồng vừa được người khác thay đổi trạng thái; vui lòng tải lại',
        );
      await tx.contractAmendment.updateMany({
        where: {
          contractId: contract.id,
          status: {
            in: [AmendmentStatus.DRAFT, AmendmentStatus.PENDING_APPROVAL],
          },
        },
        data: { status: AmendmentStatus.CANCELLED },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CANCEL',
          entity: 'contracts',
          entityId: contract.id,
          detail: {
            code: contract.code,
            from: contract.status,
            to: ContractStatus.CANCELLED,
            reason: reason ?? null,
            taskCount,
          },
        },
      });
      return tx.contract.findUniqueOrThrow({ where: { id: contract.id } });
    });
    const event: ContractCancelledEvent = {
      contractId: contract.id,
      cancelledById: user.id,
      reason: reason ?? null,
    };
    // Chờ trình nghe (đồng bộ lịch báo cáo 06) xong như các sự kiện HĐ khác — không để chạy ngầm sau
    // khi trả kết quả (gây transaction dở dang khi tắt ứng dụng).
    await this.events.emitAsync(CONTRACT_CANCELLED, event);
    return cancelled;
  }

  /** Tính tiền các dòng dịch vụ và kiểm tra tổng các đợt thanh toán bằng tổng hợp đồng. */
  buildContent(
    lines: ContractServiceLineDto[],
    vatRate: number,
    installments: InstallmentDto[] | undefined,
    startDate: string,
  ): ContractContent {
    const { lineAmounts, subtotal, vatAmount, total } = computeTotals(
      lines,
      vatRate,
    );
    const services = lines.map((l, index) => ({
      serviceTypeId: l.serviceTypeId,
      description: l.description,
      period: l.period,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: lineAmounts[index],
      assigneeId: l.assigneeId,
    }));
    const plan =
      installments && installments.length > 0
        ? installments.map((i, index) => ({
            name: i.name,
            amount: i.amount,
            dueDate: new Date(i.dueDate),
            sortOrder: index + 1,
            dueRule: i.dueRule ?? InstallmentDueRule.FIXED_DATE,
            dueOffsetDays:
              i.dueRule === InstallmentDueRule.AFTER_REPORT_ISSUE
                ? i.dueOffsetDays
                : null,
          }))
        : [
            {
              name: 'Thanh toán toàn bộ',
              amount: total.toString(),
              dueDate: new Date(
                new Date(startDate).getTime() +
                  DEFAULT_INSTALLMENT_DAYS * DAY_MS,
              ),
              sortOrder: 1,
            },
          ];
    if (!sumDecimal(plan.map((p) => p.amount)).eq(total)) {
      throw new BadRequestException(
        'Tổng các đợt thanh toán phải bằng tổng giá trị hợp đồng',
      );
    }
    return {
      totals: { subtotal, vatAmount, total },
      services,
      installments: plan,
    };
  }

  private async nextCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `HD-${year}-`;
    const rows = await this.prisma.contract.findMany({
      where: { code: { startsWith: prefix } },
      select: { code: true },
    });
    return formatCode('HD', year, nextSequence(rows.map((r) => r.code)));
  }

  private async findScoped(user: AuthUser, id: string): Promise<Contract> {
    const contract = await this.prisma.contract.findFirst({
      where: scopedContract(user, { id }),
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    return contract;
  }

  private async ensureCustomer(user: AuthUser, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        AND: [customerScope(user), { id: customerId, deletedAt: null }],
      },
      select: { id: true },
    });
    if (!customer) throw new BadRequestException('Khách hàng không tồn tại');
  }

  /** Chỉ kiểm tra dịch vụ/người khi bản sửa có gửi các trường này. */
  private async checkUpdateReferences(dto: UpdateContractDto) {
    if (dto.services || dto.ownerId || dto.salesOwnerId)
      await this.ensureReferences(
        dto.services ?? [],
        dto.ownerId,
        dto.salesOwnerId,
      );
  }

  /** J10: đợt "sau phát hành BCKT" chỉ dùng khi HĐ có dòng dịch vụ phát hành BCKT (cờ 03). */
  private async ensureMilestoneRule(
    lines: ContractServiceLineDto[],
    installments: InstallmentDto[] | undefined,
  ) {
    if (
      !installments?.some(
        (i) => i.dueRule === InstallmentDueRule.AFTER_REPORT_ISSUE,
      )
    )
      return;
    const audit = await this.prisma.serviceType.count({
      where: {
        id: { in: lines.map((l) => l.serviceTypeId) },
        issuesAuditReport: true,
      },
    });
    if (!audit)
      throw new BadRequestException(
        'Đợt "sau phát hành BCKT" chỉ dùng cho hợp đồng có dịch vụ phát hành báo cáo kiểm toán',
      );
  }

  private async ensureReferences(
    lines: ContractServiceLineDto[],
    ownerId?: string | null,
    salesOwnerId?: string | null,
  ) {
    const typeIds = [...new Set(lines.map((l) => l.serviceTypeId))];
    const typeCount = await this.prisma.serviceType.count({
      where: { id: { in: typeIds } },
    });
    if (typeCount !== typeIds.length) {
      throw new BadRequestException('Dịch vụ không tồn tại');
    }
    const userIds = [
      ...new Set(
        [ownerId, salesOwnerId, ...lines.map((l) => l.assigneeId)].filter(
          (v): v is string => !!v,
        ),
      ),
    ];
    const userCount = await this.prisma.user.count({
      where: { id: { in: userIds }, deletedAt: null },
    });
    if (userCount !== userIds.length) {
      throw new BadRequestException(
        'Người phụ trách / thực hiện không tồn tại',
      );
    }
  }
}

/** Thông tin kinh doanh (E5) đi kèm form tạo/sửa HĐ nháp. */
function businessFields(dto: CreateContractDto | UpdateContractDto) {
  return {
    salesOwnerId: dto.salesOwnerId,
    referrerName: dto.referrerName,
    referrerPhone: dto.referrerPhone,
    referrerNote: dto.referrerNote,
  };
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toOptionalDate(
  value: string | null | undefined,
): Date | null | undefined {
  return value === undefined || value === null ? value : new Date(value);
}

/** Đợt đã lưu → dạng nhập (giữ quy tắc hạn J10) khi sửa HĐ mà không gửi lại lịch đợt. */
function toInstallmentDto(i: PaymentInstallment): InstallmentDto {
  return {
    name: i.name,
    amount: i.amount.toString(),
    dueDate: toDateString(i.dueDate),
    dueRule: i.dueRule,
    dueOffsetDays: i.dueOffsetDays ?? undefined,
  };
}
