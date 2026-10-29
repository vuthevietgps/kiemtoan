import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CustomerDocumentRequest,
  DocumentCategory,
  Prisma,
  TaskStatus,
} from '@prisma/client';
import {
  TASK_NOTIFY,
  type TaskNotifyEvent,
} from '../../common/events/app-events';
import { customerScope } from '../../core/access-control/data-scope';
import { hasPermission } from '../../core/access-control/permissions';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { UploadedFileInfo } from '../../core/storage/storage.service';
import { DocumentsService } from '../documents/documents.service';
import {
  DocumentRequestAction,
  REQUEST_TRANSITIONS,
  requestActionError,
} from './document-request.rules';
import {
  DocumentRequestQueryDto,
  MarkRequestedDto,
} from './dto/document-request.dto';
import { enterWait, resumeReadyTasks, WAITABLE } from './task-waits';

type Tx = Prisma.TransactionClient;

const CONFLICT =
  'Hồ sơ vừa được người khác cập nhật; tải lại để xem trạng thái mới';
const DOCUMENT_PERIOD = /^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/;

/**
 * Hồ sơ yêu cầu của khách (đặc tả 05-D, PL1 V): 6 trạng thái, nhân viên ghi nhận đã yêu cầu và tải
 * thay khách (QD00), kiểm tra, cần bổ sung (đưa việc về Chờ khách), chấp nhận (mở lại việc — H4).
 * Phạm vi theo khách hàng (02); tải file không tự hoàn tất việc (PL1 V.4).
 */
@Injectable()
export class DocumentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly events: EventEmitter2,
  ) {}

  async list(user: AuthUser, query: DocumentRequestQueryDto) {
    const and: Prisma.CustomerDocumentRequestWhereInput[] = [
      { customerId: { in: await this.visibleCustomers(user) } },
    ];
    if (query.customerId) and.push({ customerId: query.customerId });
    if (query.contractId) and.push({ contractId: query.contractId });
    if (query.contractServiceId)
      and.push({ contractServiceId: query.contractServiceId });
    if (query.status) and.push({ status: query.status });
    if (query.period)
      and.push({ OR: [{ period: query.period }, { perPeriod: false }] });
    if (query.taskId) and.push(await this.forTask(query.taskId));
    const rows = await this.prisma.customerDocumentRequest.findMany({
      where: { AND: and },
      orderBy: [{ period: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { files: true } } },
      take: 500,
    });
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.customerId))] } },
      select: { id: true, name: true },
    });
    const name = new Map(customers.map((c) => [c.id, c.name]));
    return rows.map(({ _count, ...r }) => ({
      ...r,
      customerName: name.get(r.customerId) ?? '',
      fileCount: _count.files,
    }));
  }

  async detail(user: AuthUser, id: string) {
    const request = await this.find(user, id);
    const [events, files] = await Promise.all([
      this.prisma.customerDocumentRequestEvent.findMany({
        where: { requestId: id },
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.customerDocumentRequestFile.findMany({
        where: { requestId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const [people, documents] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: events.map((e) => e.actorId!).filter(Boolean) } },
        select: { id: true, fullName: true },
      }),
      this.prisma.document.findMany({
        where: { id: { in: files.map((f) => f.documentId) }, deletedAt: null },
        select: { id: true, fileName: true, size: true, createdAt: true },
      }),
    ]);
    const name = new Map(people.map((p) => [p.id, p]));
    return {
      ...request,
      files: documents,
      events: events.map(({ actorId, ...e }) => ({
        ...e,
        actor: actorId ? (name.get(actorId) ?? null) : null,
      })),
    };
  }

  markRequested(user: AuthUser, id: string, dto: MarkRequestedDto) {
    return this.transition(user, id, 'REQUEST', dto.note ?? null, {
      requestedAt: dto.requestedAt ? new Date(dto.requestedAt) : new Date(),
      requestMethod: dto.method?.trim() || null,
      clientDueDate: dto.clientDueDate ? new Date(dto.clientDueDate) : null,
    });
  }

  async upload(
    user: AuthUser,
    id: string,
    file: UploadedFileInfo | undefined,
    note?: string,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn file hồ sơ');
    if (!hasPermission(user, 'documents', 'create'))
      throw new ForbiddenException('Bạn không có quyền tải hồ sơ lên kho');
    const request = await this.find(user, id);
    const error = requestActionError('UPLOAD', request.status);
    if (error) throw new BadRequestException(error);
    const document = await this.documents.upload(
      user,
      request.customerId,
      file,
      {
        category:
          request.category === DocumentCategory.EVIDENCE
            ? DocumentCategory.SERVICE
            : request.category,
        contractId: request.contractId ?? undefined,
        ...(request.period &&
          DOCUMENT_PERIOD.test(request.period) && { period: request.period }),
        note: `Hồ sơ khách nộp: ${request.name}`,
      },
    );
    return this.transition(user, id, 'UPLOAD', note ?? null, {}, (tx) =>
      tx.customerDocumentRequestFile.create({
        data: { requestId: id, documentId: document.id },
      }),
    );
  }

  review(user: AuthUser, id: string) {
    return this.transition(user, id, 'REVIEW', null);
  }

  supplement(user: AuthUser, id: string, note: string) {
    return this.transition(user, id, 'SUPPLEMENT', note.trim(), {
      supplementNote: note.trim(),
    });
  }

  accept(user: AuthUser, id: string, note?: string) {
    return this.transition(user, id, 'ACCEPT', note?.trim() || null);
  }

  /**
   * Đổi trạng thái có điều kiện (bấm đồng thời → 409), ghi lịch sử, rồi tác động lên việc của bước:
   * cần bổ sung → việc về Chờ khách; chấp nhận → việc đủ hồ sơ tự mở lại; tải lên → báo người làm.
   */
  private async transition(
    user: AuthUser,
    id: string,
    action: DocumentRequestAction,
    note: string | null,
    data: Prisma.CustomerDocumentRequestUncheckedUpdateManyInput = {},
    extra?: (tx: Tx) => Promise<unknown>,
  ) {
    if (!hasPermission(user, 'tasks', 'update'))
      throw new ForbiddenException('Bạn không có quyền cập nhật hồ sơ');
    const request = await this.find(user, id);
    const error = requestActionError(action, request.status);
    if (error) throw new BadRequestException(error);
    const to = REQUEST_TRANSITIONS[action].to;
    const notify: TaskNotifyEvent[] = [];
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.customerDocumentRequest.updateMany({
        where: { id, status: request.status },
        data: { ...data, status: to },
      });
      if (!count) throw new ConflictException(CONFLICT);
      await tx.customerDocumentRequestEvent.create({
        data: {
          requestId: id,
          fromStatus: request.status,
          toStatus: to,
          actorId: user.id,
          note,
        },
      });
      await extra?.(tx);
      notify.push(...(await this.affectTasks(tx, user, request, action)));
    });
    for (const event of notify) await this.events.emitAsync(TASK_NOTIFY, event);
    return this.detail(user, id);
  }

  private async affectTasks(
    tx: Tx,
    user: AuthUser,
    request: CustomerDocumentRequest,
    action: DocumentRequestAction,
  ): Promise<TaskNotifyEvent[]> {
    const note = (text: string) => `${text}: ${request.name}`;
    if (action === 'ACCEPT')
      return (await resumeReadyTasks(tx, request, user.id)).map((t) => ({
        userIds: [t.assigneeId],
        title: note(`Đủ hồ sơ, có thể bắt đầu "${t.title}"`),
        taskId: t.id,
        actorId: user.id,
      }));
    if (action !== 'SUPPLEMENT' && action !== 'UPLOAD') return [];
    const tasks = await this.stepTasks(tx, request);
    const events: TaskNotifyEvent[] = [];
    for (const task of tasks) {
      if (
        action === 'SUPPLEMENT' &&
        request.required &&
        WAITABLE.includes(task.status)
      )
        await enterWait(tx, task, {
          automatic: true,
          requestId: request.id,
          note: note('Hồ sơ cần bổ sung'),
          actorId: user.id,
        });
      events.push({
        userIds: [task.assigneeId],
        title:
          action === 'UPLOAD'
            ? note('Khách hàng đã nộp hồ sơ')
            : note('Hồ sơ cần bổ sung'),
        taskId: task.id,
        actorId: user.id,
      });
    }
    return events;
  }

  /** Việc của bước gắn hồ sơ (cùng kỳ, hoặc mọi kỳ nếu hồ sơ một lần), chưa hoàn thành. */
  private stepTasks(tx: Tx, request: CustomerDocumentRequest) {
    if (request.taskId)
      return tx.task.findMany({
        where: { id: request.taskId, deletedAt: null },
        select: { id: true, status: true, assigneeId: true },
      });
    if (!request.contractServiceId || !request.stepKey) return [];
    return tx.task.findMany({
      where: {
        contractServiceId: request.contractServiceId,
        planStep: { stepKey: request.stepKey },
        deletedAt: null,
        status: { not: TaskStatus.COMPLETED },
        ...(request.perPeriod && { period: request.period }),
      },
      select: { id: true, status: true, assigneeId: true },
    });
  }

  /** Hồ sơ của bước và kỳ của một việc (cho chi tiết việc). */
  private async forTask(
    taskId: string,
  ): Promise<Prisma.CustomerDocumentRequestWhereInput> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        contractServiceId: true,
        period: true,
        planStep: { select: { stepKey: true } },
      },
    });
    const own = { taskId };
    if (!task?.contractServiceId || !task.planStep) return own;
    return {
      OR: [
        own,
        {
          contractServiceId: task.contractServiceId,
          stepKey: task.planStep.stepKey,
          OR: [{ period: task.period }, { perPeriod: false }],
        },
      ],
    };
  }

  private async find(user: AuthUser, id: string) {
    const request = await this.prisma.customerDocumentRequest.findFirst({
      where: { id, customerId: { in: await this.visibleCustomers(user) } },
    });
    if (!request) throw new NotFoundException('Không tìm thấy hồ sơ yêu cầu');
    return request;
  }

  private async visibleCustomers(user: AuthUser): Promise<string[]> {
    const rows = await this.prisma.customer.findMany({
      where: { AND: [{ deletedAt: null }, customerScope(user)] },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
