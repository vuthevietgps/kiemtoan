import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentCategory, PaymentStatus, Prisma } from '@prisma/client';
import { contractScope } from '../../core/access-control/data-scope';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { UploadedFileInfo } from '../../core/storage/storage.service';
import {
  exceedsRemaining,
  formatCode,
  nextSequence,
  sumDecimal,
} from '../contracts/contract-calculator';
import { DocumentsService } from '../documents/documents.service';
import { todayVn, toBusinessDate } from '../reports/utils/period.util';
import {
  AttachDocumentDto,
  CreatePaymentDto,
  UpdatePaymentDto,
} from './dto/payment.dto';
import { reallocateContract } from './payment-allocation';
import {
  BILLABLE_CONTRACT,
  EDITABLE,
  isSelfReview,
  OPEN_STATUSES,
  PAYMENT_STATUS_LABEL,
  PaymentAction,
  submitError,
  TRANSITIONS,
} from './payment.rules';
import { PAYMENT_INCLUDE } from './payments-query.service';

type Tx = Prisma.TransactionClient;
const CONFLICT =
  'Phiếu thu vừa được người khác cập nhật; vui lòng tải lại để xem trạng thái mới';

const lockContract = (tx: Tx, contractId: string) =>
  tx.$queryRaw`SELECT id FROM contracts WHERE id = ${contractId}::uuid FOR UPDATE`;

/**
 * Lệnh phiếu thu (07-C, J1–J8): lập Nháp → gửi duyệt → duyệt / trả lại; rút khi chưa duyệt; huỷ phiếu
 * đã duyệt có lý do. Chỉ phiếu Đã duyệt tính đã thu; duyệt/huỷ phân bổ lại trong cùng transaction.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
  ) {}

  /** Lập phiếu Nháp; khoá HĐ để kiểm tra không thu vượt khi lập đồng thời (J6). */
  async create(user: AuthUser, dto: CreatePaymentDto) {
    const code = await this.nextCode(new Date(dto.paidDate).getUTCFullYear());
    const payment = await this.prisma.$transaction(async (tx) => {
      await lockContract(tx, dto.contractId);
      const contract = await this.billableContract(tx, user, dto.contractId);
      this.checkInstallment(contract, dto.installmentId);
      const amount = this.checkAmountAndDate(dto.amount, dto.paidDate);
      this.checkLimit(contract, amount);
      const created = await tx.payment.create({
        data: {
          code,
          contractId: contract.id,
          installmentId: dto.installmentId,
          amount,
          paidDate: toBusinessDate(dto.paidDate),
          method: dto.method,
          documentNumber: dto.documentNumber || null,
          note: dto.note,
          receivedById: user.id,
          status: PaymentStatus.DRAFT,
        },
        include: PAYMENT_INCLUDE,
      });
      await tx.paymentEvent.create({
        data: {
          paymentId: created.id,
          toStatus: PaymentStatus.DRAFT,
          note: 'Lập phiếu',
          actorId: user.id,
        },
      });
      return created;
    });
    await this.audit.log(user.id, 'PAYMENT_CREATE', 'payments', payment.id, {
      amount: dto.amount,
      contractId: dto.contractId,
    });
    return payment;
  }

  /** Sửa phiếu Nháp / Trả lại — chỉ người lập (J5). */
  async update(user: AuthUser, id: string, dto: UpdatePaymentDto) {
    const current = await this.ownEditable(user, id);
    await this.prisma.$transaction(async (tx) => {
      await lockContract(tx, current.contractId);
      const contract = await this.billableContract(
        tx,
        user,
        current.contractId,
        id,
      );
      const installmentId =
        dto.installmentId === undefined
          ? current.installmentId
          : dto.installmentId;
      this.checkInstallment(contract, installmentId ?? undefined);
      const amount = this.checkAmountAndDate(
        dto.amount ?? current.amount.toString(),
        dto.paidDate ?? current.paidDate.toISOString().slice(0, 10),
      );
      this.checkLimit(contract, amount);
      const { count } = await tx.payment.updateMany({
        where: { id, revision: dto.revision, status: { in: EDITABLE } },
        data: {
          installmentId,
          amount,
          ...(dto.paidDate && { paidDate: toBusinessDate(dto.paidDate) }),
          method: dto.method,
          ...(dto.documentNumber !== undefined && {
            documentNumber: dto.documentNumber || null,
          }),
          ...(dto.note !== undefined && { note: dto.note }),
          revision: { increment: 1 },
        },
      });
      if (!count) throw new ConflictException(CONFLICT);
    });
    await this.audit.log(user.id, 'PAYMENT_UPDATE', 'payments', id, {
      ...dto,
    });
    return { id };
  }

  /** Đính kèm chứng từ: file mới vào kho 02 (nhóm Chứng từ thu tiền) hoặc tài liệu đã có (J6, J8). */
  async attachDocument(
    user: AuthUser,
    id: string,
    file: UploadedFileInfo | undefined,
    dto: AttachDocumentDto,
  ) {
    const payment = await this.ownEditable(user, id);
    const customerId = payment.contract.customerId;
    let documentId = dto.documentId;
    if (documentId) {
      const doc = await this.prisma.document.findFirst({
        where: {
          id: documentId,
          customerId,
          category: DocumentCategory.PAYMENT,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!doc)
        throw new BadRequestException(
          'Chứng từ phải là tài liệu "Chứng từ thu tiền" của cùng khách hàng',
        );
    } else {
      if (!file) throw new BadRequestException('Vui lòng chọn file chứng từ');
      const uploaded = await this.documents.upload(user, customerId, file, {
        category: DocumentCategory.PAYMENT,
        contractId: payment.contractId,
        note: `Chứng từ phiếu thu ${payment.code}`,
      });
      documentId = uploaded.id;
    }
    await this.prisma.paymentDocument.upsert({
      where: { paymentId_documentId: { paymentId: id, documentId } },
      create: { paymentId: id, documentId },
      update: {},
    });
    await this.audit.log(user.id, 'PAYMENT_DOCUMENT', 'payments', id, {
      documentId,
    });
    return { documentId };
  }

  async detachDocument(user: AuthUser, id: string, documentId: string) {
    await this.ownEditable(user, id);
    await this.prisma.paymentDocument.deleteMany({
      where: { paymentId: id, documentId },
    });
    return { documentId };
  }

  /** Gửi duyệt (người lập): kiểm chứng từ theo J8. */
  async submit(user: AuthUser, id: string, revision: number) {
    const payment = await this.findScoped(user, id);
    this.requireOwner(user, payment);
    const error = submitError({
      method: payment.method,
      documentNumber: payment.documentNumber,
      documentCount: payment._count.documents,
    });
    if (error) throw new BadRequestException(error);
    return this.move(user, payment, 'submit', revision, {
      note: 'Gửi duyệt',
      data: { submittedAt: new Date(), returnReason: null },
    });
  }

  /** Rút phiếu chưa duyệt (người lập) → Đã huỷ, không cần duyệt. */
  async withdraw(
    user: AuthUser,
    id: string,
    revision: number,
    reason?: string,
  ) {
    const payment = await this.findScoped(user, id);
    this.requireOwner(user, payment);
    return this.move(user, payment, 'withdraw', revision, {
      note: reason ? `Rút phiếu: ${reason}` : 'Rút phiếu',
      data: {
        cancelledAt: new Date(),
        cancelledById: user.id,
        cancelReason: reason ?? null,
      },
    });
  }

  /** Duyệt (J1): không phải người lập; kiểm lại giới hạn HĐ rồi phân bổ (J4). */
  async approve(user: AuthUser, id: string, revision: number) {
    const payment = await this.findScoped(user, id);
    if (isSelfReview(payment, user.id))
      throw new ForbiddenException(
        'Người lập phiếu không được tự duyệt phiếu của mình',
      );
    return this.move(user, payment, 'approve', revision, {
      note: 'Duyệt phiếu',
      data: { approvedAt: new Date(), approvedById: user.id },
      check: async (tx) => {
        const contract = await this.billableContract(
          tx,
          user,
          payment.contractId,
        );
        const approved = await tx.payment.aggregate({
          where: {
            contractId: payment.contractId,
            deletedAt: null,
            status: PaymentStatus.APPROVED,
          },
          _sum: { amount: true },
        });
        if (
          exceedsRemaining(
            contract.total,
            approved._sum.amount ?? 0,
            payment.amount,
          )
        )
          throw new BadRequestException('Số tiền thu vượt quá số còn phải thu');
      },
    });
  }

  async returnPayment(
    user: AuthUser,
    id: string,
    revision: number,
    reason: string,
  ) {
    const payment = await this.findScoped(user, id);
    if (isSelfReview(payment, user.id))
      throw new ForbiddenException(
        'Người lập phiếu không được tự trả lại phiếu của mình',
      );
    return this.move(user, payment, 'return', revision, {
      note: `Trả lại: ${reason}`,
      data: { returnReason: reason },
    });
  }

  /** Huỷ phiếu đã duyệt có lý do (J5): gỡ phân bổ, công nợ khôi phục, giữ bản ghi. */
  async cancel(user: AuthUser, id: string, revision: number, reason: string) {
    const payment = await this.findScoped(user, id);
    return this.move(user, payment, 'cancel', revision, {
      note: `Huỷ phiếu đã duyệt: ${reason}`,
      data: {
        cancelledAt: new Date(),
        cancelledById: user.id,
        cancelReason: reason,
      },
    });
  }

  private async move(
    user: AuthUser,
    payment: {
      id: string;
      contractId: string;
      status: PaymentStatus;
      revision: number;
    },
    action: PaymentAction,
    revision: number,
    extra: {
      note: string;
      data: Prisma.PaymentUncheckedUpdateManyInput;
      check?: (tx: Tx) => Promise<void>;
    },
  ) {
    const { from, to } = TRANSITIONS[action];
    // Người dùng thao tác trên bản cũ (người khác vừa đổi phiếu) → 409, kể cả khi trạng thái đã đổi.
    if (payment.revision !== revision) throw new ConflictException(CONFLICT);
    if (!from.includes(payment.status))
      throw new BadRequestException(
        `Không thể thao tác với phiếu ở trạng thái "${PAYMENT_STATUS_LABEL[payment.status]}"`,
      );
    await this.prisma.$transaction(async (tx) => {
      await lockContract(tx, payment.contractId);
      await extra.check?.(tx);
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: payment.status, revision },
        data: { ...extra.data, status: to, revision: { increment: 1 } },
      });
      if (!count) throw new ConflictException(CONFLICT);
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          fromStatus: payment.status,
          toStatus: to,
          note: extra.note,
          actorId: user.id,
        },
      });
      if (
        payment.status === PaymentStatus.APPROVED ||
        to === PaymentStatus.APPROVED
      )
        await reallocateContract(tx, payment.contractId);
    });
    await this.audit.log(
      user.id,
      `PAYMENT_${action.toUpperCase()}`,
      'payments',
      payment.id,
      { from: payment.status, to, note: extra.note },
    );
    return { id: payment.id, status: to };
  }

  private async findScoped(user: AuthUser, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null, contract: contractScope(user) },
      include: {
        contract: { select: { customerId: true } },
        _count: { select: { documents: true } },
      },
    });
    if (!payment) throw new NotFoundException('Không tìm thấy phiếu thu');
    return payment;
  }

  private requireOwner(user: AuthUser, payment: { receivedById: string }) {
    if (payment.receivedById !== user.id)
      throw new ForbiddenException('Chỉ người lập phiếu được thao tác này');
  }

  private async ownEditable(user: AuthUser, id: string) {
    const payment = await this.findScoped(user, id);
    this.requireOwner(user, payment);
    if (!EDITABLE.includes(payment.status))
      throw new BadRequestException('Chỉ sửa được phiếu Nháp hoặc bị trả lại');
    return payment;
  }

  /** HĐ trong phạm vi, đã duyệt (J7), kèm tổng phiếu đang mở (trừ phiếu đang sửa). */
  private async billableContract(
    tx: Tx,
    user: AuthUser,
    contractId: string,
    exceptId?: string,
  ) {
    const contract = await tx.contract.findFirst({
      where: {
        AND: [contractScope(user), { id: contractId, deletedAt: null }],
      },
      include: {
        installments: { select: { id: true } },
        payments: {
          where: {
            deletedAt: null,
            status: { in: OPEN_STATUSES },
            ...(exceptId && { id: { not: exceptId } }),
          },
          select: { amount: true },
        },
      },
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    if (!BILLABLE_CONTRACT.includes(contract.status))
      throw new BadRequestException(
        'Chỉ thu tiền cho hợp đồng đã duyệt (không thu hợp đồng nháp, chờ duyệt hoặc đã huỷ)',
      );
    return contract;
  }

  private checkInstallment(
    contract: { installments: { id: string }[] },
    installmentId: string | undefined,
  ) {
    if (
      installmentId &&
      !contract.installments.some((i) => i.id === installmentId)
    )
      throw new BadRequestException('Đợt thanh toán không thuộc hợp đồng');
  }

  /** Số tiền > 0; ngày thu = ngày tiền về, không sau hôm nay giờ VN (J3). */
  private checkAmountAndDate(amountText: string, paidDate: string) {
    const amount = new Prisma.Decimal(amountText);
    if (amount.lte(0))
      throw new BadRequestException('Số tiền thu phải lớn hơn 0');
    if (toBusinessDate(paidDate) > todayVn())
      throw new BadRequestException('Ngày thu không được sau hôm nay');
    return amount;
  }

  /** J6: tổng phiếu đang mở + phiếu này không vượt tổng HĐ. */
  private checkLimit(
    contract: { total: Prisma.Decimal; payments: { amount: Prisma.Decimal }[] },
    amount: Prisma.Decimal,
  ) {
    const open = sumDecimal(contract.payments.map((p) => p.amount));
    if (exceedsRemaining(contract.total, open, amount))
      throw new BadRequestException('Số tiền thu vượt quá số còn phải thu');
  }

  private async nextCode(year: number): Promise<string> {
    const rows = await this.prisma.payment.findMany({
      where: { code: { startsWith: `PT-${year}-` } },
      select: { code: true },
    });
    return formatCode('PT', year, nextSequence(rows.map((r) => r.code)));
  }
}
