import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Contract,
  ContractPlanStatus,
  ContractStatus,
  Prisma,
  TaskGenerationStatus,
} from '@prisma/client';
import {
  CONTRACT_APPROVED,
  CONTRACT_TASKS_REQUESTED,
  ContractApprovedEvent,
} from '../../common/events/app-events';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { sumDecimal } from './contract-calculator';
import { scopedContract } from './contracts-query.service';

const { DRAFT, PENDING_APPROVAL, NOT_STARTED, IN_PROGRESS } = ContractStatus;

/** HĐ đã duyệt còn đang thực hiện thì được sinh lại việc cho dòng chưa sinh/lỗi. */
const GENERATABLE_CONTRACT: ContractStatus[] = [NOT_STARTED, IN_PROGRESS];
const RETRYABLE: TaskGenerationStatus[] = [
  TaskGenerationStatus.PENDING,
  TaskGenerationStatus.SKIPPED,
  TaskGenerationStatus.FAILED,
];

const WITH_LINES = {
  services: {
    select: {
      id: true,
      taskGenerationStatus: true,
      serviceType: { select: { code: true, isActive: true } },
      plan: { select: { status: true } },
    },
  },
  installments: { select: { amount: true } },
} satisfies Prisma.ContractInclude;

/**
 * Gửi duyệt, duyệt, trả lại và sinh lại việc (đặc tả 04-A). Mọi chuyển trạng thái là cập nhật
 * có điều kiện để thao tác đồng thời chỉ thành công một lần.
 */
@Injectable()
export class ContractsApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async submit(user: AuthUser, id: string): Promise<Contract> {
    const contract = await this.findScoped(user, id);
    if (contract.status !== DRAFT)
      throw new BadRequestException('Chỉ gửi duyệt được hợp đồng nháp');
    if (contract.services.length === 0)
      throw new BadRequestException('Hợp đồng cần ít nhất một dòng dịch vụ');
    const inactive = contract.services.find((s) => !s.serviceType.isActive);
    if (inactive)
      throw new BadRequestException(
        `Dịch vụ ${inactive.serviceType.code} đã ngừng cung cấp, hãy đổi dịch vụ trước khi gửi duyệt`,
      );
    const scheduled = sumDecimal(contract.installments.map((i) => i.amount));
    if (!scheduled.eq(contract.total))
      throw new BadRequestException(
        'Tổng các đợt thanh toán phải bằng tổng giá trị hợp đồng',
      );
    return this.transition(user, id, DRAFT, PENDING_APPROVAL, 'SUBMIT', {});
  }

  /** Chỉ duyệt từ Chờ duyệt (E3). Bấm đồng thời: một lần thành công, lần sau 409. */
  async approve(user: AuthUser, id: string): Promise<Contract> {
    const contract = await this.findScoped(user, id);
    // Bấm lại sau khi đã duyệt (kể cả đúp chuột) trả 409 như trường hợp đồng thời.
    if (contract.status !== PENDING_APPROVAL && contract.approvedAt)
      throw new ConflictException('Hợp đồng đã được duyệt');
    if (contract.status !== PENDING_APPROVAL)
      throw new BadRequestException('Hợp đồng không ở trạng thái chờ duyệt');
    const approved = await this.transition(
      user,
      id,
      PENDING_APPROVAL,
      NOT_STARTED,
      'APPROVE',
      { approvedById: user.id, approvedAt: new Date() },
    );
    const event: ContractApprovedEvent = {
      contractId: id,
      approvedById: user.id,
    };
    // Chờ sinh việc xong (listener tự bắt lỗi, không làm hỏng việc duyệt) để màn hình tải lại thấy ngay kết quả.
    await this.events.emitAsync(CONTRACT_APPROVED, event);
    return approved;
  }

  /** Trả lại Chờ duyệt → Nháp kèm lý do (E3). */
  async returnToDraft(
    user: AuthUser,
    id: string,
    reason: string,
  ): Promise<Contract> {
    const contract = await this.findScoped(user, id);
    if (contract.status !== PENDING_APPROVAL)
      throw new BadRequestException('Chỉ trả lại được hợp đồng đang chờ duyệt');
    return this.transition(user, id, PENDING_APPROVAL, DRAFT, 'RETURN', {
      returnedReason: reason,
      returnedAt: new Date(),
    });
  }

  /** Sinh lại việc cho các dòng chưa sinh/bỏ qua/lỗi; chờ xử lý xong rồi trả trạng thái từng dòng. */
  async regenerateTasks(user: AuthUser, id: string) {
    const contract = await this.findScoped(user, id);
    if (!GENERATABLE_CONTRACT.includes(contract.status))
      throw new BadRequestException(
        'Chỉ sinh việc cho hợp đồng đã duyệt và đang thực hiện',
      );
    const pending = contract.services.filter((s) =>
      RETRYABLE.includes(s.taskGenerationStatus),
    );
    if (pending.length === 0)
      throw new ConflictException('Mọi dòng dịch vụ đã được sinh việc');
    // E1: chỉ sinh cho dòng đã xác nhận kế hoạch thực hiện.
    if (!pending.some((s) => s.plan?.status === ContractPlanStatus.CONFIRMED))
      throw new ConflictException(
        'Chưa có dòng dịch vụ nào đã xác nhận kế hoạch thực hiện để sinh việc',
      );
    const event: ContractApprovedEvent = {
      contractId: id,
      approvedById: user.id,
    };
    await this.events.emitAsync(CONTRACT_TASKS_REQUESTED, event);
    return this.prisma.contractService.findMany({
      where: { contractId: id },
      select: {
        id: true,
        taskGenerationStatus: true,
        taskGenerationMessage: true,
        tasksGeneratedAt: true,
      },
    });
  }

  private async transition(
    user: AuthUser,
    id: string,
    from: ContractStatus,
    to: ContractStatus,
    action: string,
    data: Prisma.ContractUncheckedUpdateManyInput,
  ): Promise<Contract> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.contract.updateMany({
        where: { id, status: from, deletedAt: null },
        data: { ...data, status: to },
      });
      if (count === 0)
        throw new ConflictException(
          'Hợp đồng vừa được người khác thay đổi trạng thái; vui lòng tải lại',
        );
      const contract = await tx.contract.findUniqueOrThrow({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action,
          entity: 'contracts',
          entityId: id,
          detail: {
            code: contract.code,
            from,
            to,
            ...('returnedReason' in data && { reason: data.returnedReason }),
          },
        },
      });
      return contract;
    });
  }

  private async findScoped(user: AuthUser, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: scopedContract(user, { id }),
      include: WITH_LINES,
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    return contract;
  }
}
