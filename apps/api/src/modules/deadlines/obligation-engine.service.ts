import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  CustomerStatus,
  DocumentCategory,
  ObligationStatus,
  TaskStatus,
} from '@prisma/client';
import {
  CONTRACT_APPROVED,
  CONTRACT_CANCELLED,
  CUSTOMER_TAX_PROFILE_CHANGED,
  OBLIGATION_DUES_CHANGED,
  TASK_OBLIGATION_PROGRESS,
  type ContractApprovedEvent,
  type ContractCancelledEvent,
  type CustomerTaxProfileChangedEvent,
  type ObligationDuesChangedEvent,
  type TaskObligationProgressEvent,
} from '../../common/events/app-events';
import { PrismaService } from '../../core/prisma/prisma.service';
import { todayVn, vnDateOf } from '../reports/utils/period.util';
import {
  loadWorkingCalendar,
  recalculateObligationDues,
  syncCustomerObligations,
  type SyncResult,
} from './obligation-sync';

const TX = { timeout: 60_000 };
const NOT_STARTED_TASK: TaskStatus[] = [
  TaskStatus.NOT_STARTED,
  TaskStatus.WAITING_CLIENT,
];

/**
 * Điều phối lịch báo cáo (đặc tả 06-B): đồng bộ theo KH khi HĐ duyệt/huỷ hoặc hồ sơ thuế đổi,
 * tính lại hạn khi lịch/quy tắc đổi (I8), cập nhật trạng thái theo việc gắn (I6).
 */
@Injectable()
export class ObligationEngine {
  private readonly logger = new Logger(ObligationEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async syncCustomer(
    customerId: string,
    actorId: string | null,
  ): Promise<SyncResult> {
    const calendar = await loadWorkingCalendar(this.prisma);
    return this.prisma.$transaction(
      (tx) =>
        syncCustomerObligations(tx, customerId, {
          calendar,
          today: todayVn(),
          actorId,
        }),
      TX,
    );
  }

  /** Đồng bộ mọi KH có thể bị ảnh hưởng: đang phục vụ hoặc đã có lịch báo cáo/cài đặt riêng. */
  async syncAll(actorId: string | null): Promise<SyncResult> {
    const customers = await this.prisma.customer.findMany({
      where: {
        OR: [
          { status: CustomerStatus.ACTIVE, deletedAt: null },
          { obligations: { some: {} } },
          { obligationSettings: { some: {} } },
        ],
      },
      select: { id: true },
    });
    const total: SyncResult = { created: 0, revived: 0, retired: 0 };
    for (const { id } of customers) {
      const r = await this.syncCustomer(id, actorId);
      total.created += r.created;
      total.revived += r.revived;
      total.retired += r.retired;
    }
    return total;
  }

  /** I8: tính lại hạn chưa tới; báo 05 đổi hạn việc gắn. Trả số nghĩa vụ đổi hạn. */
  async recalculate(
    actorId: string,
    reason: string,
    typeIds?: string[],
  ): Promise<number> {
    const calendar = await loadWorkingCalendar(this.prisma);
    const changes = await this.prisma.$transaction(
      (tx) =>
        recalculateObligationDues(tx, {
          calendar,
          today: todayVn(),
          actorId,
          reason,
          typeIds,
        }),
      TX,
    );
    if (changes.length) {
      const event: ObligationDuesChangedEvent = { changes, actorId, reason };
      await this.events.emitAsync(OBLIGATION_DUES_CHANGED, event);
    }
    return changes.length;
  }

  @OnEvent(CONTRACT_APPROVED)
  async onContractApproved(event: ContractApprovedEvent): Promise<void> {
    await this.syncContractCustomer(event.contractId, event.approvedById);
  }

  @OnEvent(CONTRACT_CANCELLED)
  async onContractCancelled(event: ContractCancelledEvent): Promise<void> {
    await this.syncContractCustomer(event.contractId, event.cancelledById);
  }

  @OnEvent(CUSTOMER_TAX_PROFILE_CHANGED)
  async onCustomerChanged(event: CustomerTaxProfileChangedEvent) {
    try {
      await this.syncCustomer(event.customerId, event.actorId);
    } catch (err) {
      this.logger.error(
        `Không đồng bộ được lịch báo cáo KH ${event.customerId}`,
        err,
      );
    }
  }

  /** I6: việc gắn bắt đầu → Đang chuẩn bị; Hoàn thành có file kết quả → Đã nộp kèm biên nhận. */
  @OnEvent(TASK_OBLIGATION_PROGRESS)
  async onTaskProgress(event: TaskObligationProgressEvent): Promise<void> {
    try {
      await this.applyTaskProgress(event);
    } catch (err) {
      this.logger.error(
        `Không cập nhật được nghĩa vụ ${event.obligationId}`,
        err,
      );
    }
  }

  private async applyTaskProgress(event: TaskObligationProgressEvent) {
    const obligation = await this.prisma.customerObligation.findUnique({
      where: { id: event.obligationId },
    });
    if (
      !obligation ||
      (obligation.status !== ObligationStatus.NOT_DUE &&
        obligation.status !== ObligationStatus.PREPARING)
    )
      return;
    const status = event.status as TaskStatus;
    if (status !== TaskStatus.COMPLETED) {
      if (
        NOT_STARTED_TASK.includes(status) ||
        obligation.status !== ObligationStatus.NOT_DUE
      )
        return;
      await this.move(obligation, ObligationStatus.PREPARING, event.actorId, {
        note: 'Việc gắn đã bắt đầu',
      });
      return;
    }
    const task = await this.prisma.task.findUnique({
      where: { id: event.taskId },
      select: {
        completedAt: true,
        documents: {
          where: { category: DocumentCategory.EVIDENCE, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });
    const receipt = task?.documents[0];
    if (!receipt) {
      // Ghi lịch sử cả khi đã Đang chuẩn bị, để người phụ trách biết còn thiếu biên nhận.
      await this.move(obligation, ObligationStatus.PREPARING, event.actorId, {
        note: 'Việc gắn đã hoàn thành nhưng chưa có file biên nhận — hãy đánh dấu Đã nộp kèm biên nhận',
      });
      return;
    }
    const filedAt = vnDateOf(task.completedAt ?? new Date());
    await this.move(obligation, ObligationStatus.FILED, event.actorId, {
      note: 'Đã nộp theo việc giao nộp hoàn thành',
      data: {
        filedAt,
        filedLate: filedAt > obligation.dueDate,
        filedById: event.actorId,
        receiptDocumentId: receipt.id,
      },
    });
  }

  private async move(
    o: { id: string; status: ObligationStatus; revision: number },
    to: ObligationStatus,
    actorId: string,
    extra: {
      note: string;
      data?: {
        filedAt: Date;
        filedLate: boolean;
        filedById: string;
        receiptDocumentId: string;
      };
    },
  ) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.customerObligation.updateMany({
        where: { id: o.id, status: o.status, revision: o.revision },
        data: { status: to, revision: { increment: 1 }, ...extra.data },
      });
      if (count)
        await tx.customerObligationEvent.create({
          data: {
            obligationId: o.id,
            fromStatus: o.status,
            toStatus: to,
            note: extra.note,
            actorId,
          },
        });
    });
  }

  private async syncContractCustomer(contractId: string, actorId: string) {
    try {
      const contract = await this.prisma.contract.findUnique({
        where: { id: contractId },
        select: { customerId: true },
      });
      if (contract) await this.syncCustomer(contract.customerId, actorId);
    } catch (err) {
      this.logger.error(
        `Không đồng bộ được lịch báo cáo theo HĐ ${contractId}`,
        err,
      );
    }
  }
}
