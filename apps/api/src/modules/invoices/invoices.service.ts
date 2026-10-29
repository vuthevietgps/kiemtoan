import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentCategory,
  Invoice,
  InvoiceKind,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import { contractScope } from '../../core/access-control/data-scope';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { UploadedFileInfo } from '../../core/storage/storage.service';
import { sumDecimal, vatOf } from '../contracts/contract-calculator';
import { DocumentsService } from '../documents/documents.service';
import { BILLABLE_CONTRACT } from '../payments/payment.rules';
import { todayVn, toBusinessDate } from '../reports/utils/period.util';
import { isUniqueViolation } from '../service-catalog/workflow.repository';
import {
  AdjustInvoiceDto,
  CancelInvoiceDto,
  CreateInvoiceDto,
  InvoiceIdentityDto,
  IssueInvoiceDto,
  ReplaceInvoiceDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto';
import {
  heldSubtotal,
  HOLDING_STATUSES,
  INVOICE_STATUS_LABEL,
  normalizeIdentity,
  splitTotal,
} from './invoice.rules';
import { InvoicesQueryService } from './invoices-query.service';

type Tx = Prisma.TransactionClient;
const { REQUESTED, ISSUED, ADJUSTED, REPLACED, CANCELLED } = InvoiceStatus;
const CONFLICT =
  'Hoá đơn vừa được người khác cập nhật; vui lòng tải lại để xem trạng thái mới';
const DUPLICATE =
  'Hoá đơn có cùng ký hiệu mẫu số, ký hiệu và số đã được ghi nhận';
const OVER_LIMIT =
  'Giá trị hoá đơn vượt quá phần giá trị hợp đồng chưa xuất hoá đơn';

const lockContract = (tx: Tx, contractId: string) =>
  tx.$queryRaw`SELECT id FROM contracts WHERE id = ${contractId}::uuid FOR UPDATE`;

/** File hoá đơn gửi kèm multipart (K5): PDF bắt buộc, XML tuỳ chọn. */
export interface InvoiceFiles {
  pdf?: UploadedFileInfo;
  xml?: UploadedFileInfo;
}

/**
 * Lệnh sổ hoá đơn nội bộ (08, K1–K9): đề nghị theo đợt / giá trị, sửa và huỷ đề nghị, ghi nhận đã xuất
 * trên cổng EasyInvoice kèm PDF/XML, điều chỉnh / thay thế hoá đơn đã xuất. Mọi lệnh trong transaction
 * có khoá HĐ, kiểm `revision`, ghi lịch sử và nhật ký.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
    private readonly query: InvoicesQueryService,
  ) {}

  /** Đề nghị xuất (K2, K3, K7). */
  async create(user: AuthUser, dto: CreateInvoiceDto) {
    const contract = await this.billableContract(user, dto.contractId);
    const id = await this.prisma.$transaction(async (tx) => {
      await lockContract(tx, contract.id);
      const held = heldSubtotal(
        await tx.invoice.findMany({
          where: { contractId: contract.id },
          select: { status: true, subtotal: true },
        }),
      );
      const amounts = dto.installmentIds?.length
        ? await this.installmentAmounts(tx, contract, dto.installmentIds)
        : this.valueAmounts(contract, held, dto.subtotal);
      if (amounts.subtotal.lte(0))
        throw new BadRequestException(
          dto.subtotal || dto.installmentIds?.length
            ? 'Giá trị hoá đơn phải lớn hơn 0'
            : 'Hợp đồng đã xuất đủ hoá đơn',
        );
      if (held.add(amounts.subtotal).gt(contract.subtotal))
        throw new BadRequestException(OVER_LIMIT);
      const invoice = await tx.invoice.create({
        data: {
          contractId: contract.id,
          subtotal: amounts.subtotal,
          vatAmount: amounts.vatAmount,
          total: amounts.total,
          note: dto.note,
          requestedById: user.id,
          buyerName: dto.buyerName ?? contract.customer.name,
          buyerTaxCode: dto.buyerTaxCode ?? contract.customer.taxCode,
          buyerAddress:
            dto.buyerAddress === undefined
              ? contract.customer.address
              : dto.buyerAddress,
          buyerEmail:
            dto.buyerEmail === undefined
              ? contract.customer.contactEmail
              : dto.buyerEmail,
          installments: dto.installmentIds?.length
            ? {
                create: [...new Set(dto.installmentIds)].map(
                  (installmentId) => ({ installmentId }),
                ),
              }
            : undefined,
          events: {
            create: {
              toStatus: REQUESTED,
              note: 'Đề nghị xuất',
              actorId: user.id,
            },
          },
        },
      });
      return invoice.id;
    });
    await this.audit.log(user.id, 'INVOICE_REQUEST', 'invoices', id, {
      contractId: contract.id,
      installmentIds: dto.installmentIds ?? [],
    });
    return this.query.findOne(user, id);
  }

  /** Sửa đề nghị chưa xuất: người mua, ghi chú (K7). */
  async update(user: AuthUser, id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findScoped(user, id);
    this.requireStatus(invoice, [REQUESTED], 'Chỉ sửa được đề nghị chưa xuất');
    const { revision, ...fields } = dto;
    await this.prisma.$transaction(async (tx) => {
      await this.bump(tx, invoice, revision, fields);
      await this.event(tx, invoice, REQUESTED, user, 'Sửa đề nghị');
    });
    await this.audit.log(user.id, 'INVOICE_UPDATE', 'invoices', id, {
      ...fields,
    });
    return this.query.findOne(user, id);
  }

  /** Huỷ đề nghị chưa xuất, có lý do (K1). Hoá đơn đã xuất không huỷ — dùng điều chỉnh / thay thế (K6). */
  async cancel(user: AuthUser, id: string, dto: CancelInvoiceDto) {
    const invoice = await this.findScoped(user, id);
    this.requireStatus(
      invoice,
      [REQUESTED],
      'Hoá đơn đã xuất không huỷ được; hãy lập hoá đơn điều chỉnh hoặc thay thế',
    );
    await this.prisma.$transaction(async (tx) => {
      await this.bump(tx, invoice, dto.revision, {
        status: CANCELLED,
        reason: dto.reason,
      });
      await this.event(
        tx,
        invoice,
        CANCELLED,
        user,
        `Huỷ đề nghị: ${dto.reason}`,
      );
    });
    await this.audit.log(user.id, 'INVOICE_CANCEL', 'invoices', id, {
      reason: dto.reason,
    });
    return this.query.findOne(user, id);
  }

  /** Ghi nhận đã xuất trên cổng EasyInvoice (K5): số, ký hiệu, ngày, PDF bắt buộc. */
  async issue(
    user: AuthUser,
    id: string,
    files: InvoiceFiles,
    dto: IssueInvoiceDto,
  ) {
    const invoice = await this.findScoped(user, id);
    this.requireStatus(
      invoice,
      [REQUESTED],
      'Chỉ ghi nhận xuất cho đề nghị đang chờ xuất',
    );
    if (invoice.revision !== dto.revision)
      throw new ConflictException(CONFLICT);
    const identity = this.identity(dto);
    const documents = await this.storeFiles(user, invoice, files, identity);
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.bump(tx, invoice, dto.revision, {
          ...identity,
          status: ISSUED,
          issuedById: user.id,
          issuedAt: new Date(),
        });
        await this.link(tx, invoice.id, documents);
        await this.event(tx, invoice, ISSUED, user, this.label(identity));
      });
    } catch (error) {
      await this.dropFiles(user, documents);
      throw isUniqueViolation(error) ? new ConflictException(DUPLICATE) : error;
    }
    await this.audit.log(user.id, 'INVOICE_ISSUE', 'invoices', id, {
      ...identity,
      issueDate: dto.issueDate,
    });
    return this.query.findOne(user, id);
  }

  /** Hoá đơn điều chỉnh tăng / giảm (K6): hoá đơn gốc → Đã điều chỉnh, vẫn hiệu lực. */
  async adjust(
    user: AuthUser,
    id: string,
    files: InvoiceFiles,
    dto: AdjustInvoiceDto,
  ) {
    const original = await this.findScoped(user, id);
    if (original.kind === InvoiceKind.ADJUSTMENT)
      throw new BadRequestException('Hãy điều chỉnh trên hoá đơn gốc');
    this.requireStatus(
      original,
      [ISSUED, ADJUSTED],
      'Chỉ điều chỉnh hoá đơn đã xuất còn hiệu lực',
    );
    if (original.revision !== dto.revision)
      throw new ConflictException(CONFLICT);
    const sign = dto.direction === 'DECREASE' ? -1 : 1;
    const subtotal = new Prisma.Decimal(dto.subtotal).mul(sign);
    if (subtotal.isZero())
      throw new BadRequestException('Số tiền điều chỉnh phải khác 0');
    return this.derive(user, original, files, dto, {
      kind: InvoiceKind.ADJUSTMENT,
      subtotal,
      originalStatus: ADJUSTED,
      action: 'INVOICE_ADJUST',
      note: `${sign < 0 ? 'Điều chỉnh giảm' : 'Điều chỉnh tăng'}: ${dto.reason}`,
      check: async (tx, held) => {
        if (held.add(subtotal).gt(original.contract.subtotal))
          throw new BadRequestException(OVER_LIMIT);
        const chain = await tx.invoice.findMany({
          where: { relatedId: original.id, kind: InvoiceKind.ADJUSTMENT },
          select: { subtotal: true },
        });
        const value = sumDecimal(chain.map((c) => c.subtotal))
          .add(original.subtotal)
          .add(subtotal);
        if (value.lt(0))
          throw new BadRequestException(
            'Điều chỉnh giảm vượt quá giá trị còn lại của hoá đơn gốc',
          );
      },
    });
  }

  /** Hoá đơn thay thế (K6): hoá đơn gốc → Bị thay thế, hết hiệu lực; đợt chuyển sang hoá đơn mới. */
  async replace(
    user: AuthUser,
    id: string,
    files: InvoiceFiles,
    dto: ReplaceInvoiceDto,
  ) {
    const original = await this.findScoped(user, id);
    if (original.kind === InvoiceKind.ADJUSTMENT)
      throw new BadRequestException('Không thay thế hoá đơn điều chỉnh');
    this.requireStatus(
      original,
      [ISSUED],
      'Chỉ thay thế hoá đơn đã xuất chưa điều chỉnh; hoá đơn đã điều chỉnh tiếp tục lập điều chỉnh',
    );
    if (original.revision !== dto.revision)
      throw new ConflictException(CONFLICT);
    const subtotal = new Prisma.Decimal(dto.subtotal);
    if (subtotal.lte(0))
      throw new BadRequestException('Giá trị hoá đơn thay thế phải lớn hơn 0');
    return this.derive(user, original, files, dto, {
      kind: InvoiceKind.REPLACEMENT,
      subtotal,
      originalStatus: REPLACED,
      action: 'INVOICE_REPLACE',
      note: `Thay thế: ${dto.reason}`,
      buyer: {
        buyerName: dto.buyerName ?? original.buyerName,
        buyerTaxCode: dto.buyerTaxCode ?? original.buyerTaxCode,
        buyerAddress:
          dto.buyerAddress === undefined
            ? original.buyerAddress
            : dto.buyerAddress,
      },
      check: (_tx, held) => {
        if (
          held
            .sub(original.subtotal)
            .add(subtotal)
            .gt(original.contract.subtotal)
        )
          throw new BadRequestException(OVER_LIMIT);
        return Promise.resolve();
      },
    });
  }

  /** Lập hoá đơn điều chỉnh / thay thế đã xuất, liên kết hoá đơn gốc, đổi trạng thái gốc. */
  private async derive(
    user: AuthUser,
    original: ScopedInvoice,
    files: InvoiceFiles,
    dto: InvoiceIdentityDto & { reason: string },
    options: {
      kind: InvoiceKind;
      subtotal: Prisma.Decimal;
      originalStatus: InvoiceStatus;
      action: string;
      note: string;
      buyer?: Pick<Invoice, 'buyerName' | 'buyerTaxCode' | 'buyerAddress'>;
      check: (tx: Tx, held: Prisma.Decimal) => Promise<void>;
    },
  ) {
    const identity = this.identity(dto);
    const documents = await this.storeFiles(user, original, files, identity);
    let createdId = '';
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockContract(tx, original.contractId);
        const held = heldSubtotal(
          await tx.invoice.findMany({
            where: { contractId: original.contractId },
            select: { status: true, subtotal: true },
          }),
        );
        await options.check(tx, held);
        await this.bump(tx, original, dto.revision, {
          status: options.originalStatus,
        });
        await this.event(
          tx,
          original,
          options.originalStatus,
          user,
          options.note,
        );
        // Hoá đơn thay thế nhận các đợt của hoá đơn gốc; điều chỉnh không gắn đợt.
        const links =
          options.kind === InvoiceKind.REPLACEMENT
            ? await tx.invoiceInstallment.findMany({
                where: { invoiceId: original.id },
                select: { installmentId: true },
              })
            : [];
        const created = await tx.invoice.create({
          data: this.derivedData(user, original, identity, dto.reason, {
            ...options,
            links,
          }),
        });
        createdId = created.id;
        await this.link(tx, created.id, documents);
      });
    } catch (error) {
      await this.dropFiles(user, documents);
      throw isUniqueViolation(error) ? new ConflictException(DUPLICATE) : error;
    }
    await this.audit.log(user.id, options.action, 'invoices', createdId, {
      relatedId: original.id,
      ...identity,
      subtotal: options.subtotal.toString(),
      reason: dto.reason,
    });
    return this.query.findOne(user, createdId);
  }

  /** Dữ liệu hoá đơn điều chỉnh / thay thế: đã xuất, liên kết gốc, người mua lấy từ gốc trừ khi sửa. */
  private derivedData(
    user: AuthUser,
    original: ScopedInvoice,
    identity: ReturnType<InvoicesService['identity']>,
    reason: string,
    options: {
      kind: InvoiceKind;
      subtotal: Prisma.Decimal;
      note: string;
      buyer?: Pick<Invoice, 'buyerName' | 'buyerTaxCode' | 'buyerAddress'>;
      links: { installmentId: string }[];
    },
  ): Prisma.InvoiceUncheckedCreateInput {
    const vatAmount = vatOf(options.subtotal, original.contract.vatRate);
    return {
      contractId: original.contractId,
      kind: options.kind,
      relatedId: original.id,
      ...identity,
      subtotal: options.subtotal,
      vatAmount,
      total: options.subtotal.add(vatAmount),
      status: ISSUED,
      reason,
      requestedById: user.id,
      issuedById: user.id,
      issuedAt: new Date(),
      buyerName: options.buyer?.buyerName ?? original.buyerName,
      buyerTaxCode: options.buyer?.buyerTaxCode ?? original.buyerTaxCode,
      buyerAddress: options.buyer
        ? options.buyer.buyerAddress
        : original.buyerAddress,
      buyerEmail: original.buyerEmail,
      installments: options.links.length
        ? { create: options.links }
        : undefined,
      events: {
        create: { toStatus: ISSUED, note: options.note, actorId: user.id },
      },
    };
  }

  /** HĐ trong phạm vi, đã duyệt (cùng danh sách J7 của 07), kèm người mua để chụp lại (K7). */
  private async billableContract(user: AuthUser, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { AND: [contractScope(user), { id, deletedAt: null }] },
      select: {
        id: true,
        status: true,
        subtotal: true,
        vatRate: true,
        customer: {
          select: {
            name: true,
            taxCode: true,
            address: true,
            contactEmail: true,
          },
        },
      },
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
    if (!BILLABLE_CONTRACT.includes(contract.status))
      throw new BadRequestException(
        'Chỉ đề nghị xuất hoá đơn cho hợp đồng đã duyệt',
      );
    return contract;
  }

  /** K2: đợt thuộc HĐ và chưa nằm trong đề nghị / hoá đơn đang giữ; tiền = tổng đợt (gồm VAT). */
  private async installmentAmounts(
    tx: Tx,
    contract: { id: string; vatRate: Prisma.Decimal },
    ids: string[],
  ) {
    const unique = [...new Set(ids)];
    const installments = await tx.paymentInstallment.findMany({
      where: { id: { in: unique }, contractId: contract.id },
      select: {
        amount: true,
        invoiceLinks: {
          where: { invoice: { status: { in: HOLDING_STATUSES } } },
          select: { invoiceId: true },
        },
      },
    });
    if (installments.length !== unique.length)
      throw new BadRequestException('Đợt thanh toán không thuộc hợp đồng này');
    if (installments.some((i) => i.invoiceLinks.length))
      throw new BadRequestException('Đợt đã có đề nghị hoặc hoá đơn');
    return splitTotal(
      sumDecimal(installments.map((i) => i.amount)),
      contract.vatRate,
    );
  }

  /** K2/K3: theo giá trị trước VAT; bỏ trống = phần chưa xuất. */
  private valueAmounts(
    contract: { subtotal: Prisma.Decimal; vatRate: Prisma.Decimal },
    held: Prisma.Decimal,
    value?: string,
  ) {
    const subtotal = value
      ? new Prisma.Decimal(value)
      : contract.subtotal.sub(held);
    const vatAmount = vatOf(subtotal, contract.vatRate);
    return { subtotal, vatAmount, total: subtotal.add(vatAmount) };
  }

  /** Thông tin hoá đơn đã xuất (K5): chuẩn hoá để chặn trùng; ngày lập không sau hôm nay giờ VN. */
  private identity(dto: InvoiceIdentityDto) {
    const issueDate = toBusinessDate(dto.issueDate);
    if (issueDate > todayVn())
      throw new BadRequestException('Ngày lập hoá đơn không được sau hôm nay');
    return {
      ...normalizeIdentity(dto),
      issueDate,
      lookupCode: dto.lookupCode ?? null,
      taxAuthorityCode: dto.taxAuthorityCode ?? null,
    };
  }

  /** Lưu PDF (bắt buộc) và XML (tuỳ chọn) vào kho hồ sơ KH, nhóm Hoá đơn, gắn HĐ (K5). */
  private async storeFiles(
    user: AuthUser,
    invoice: ScopedInvoice,
    files: InvoiceFiles,
    identity: { symbol: string; number: string },
  ) {
    if (!files.pdf)
      throw new BadRequestException('Vui lòng đính kèm file PDF hoá đơn');
    if (!files.pdf.originalname.toLowerCase().endsWith('.pdf'))
      throw new BadRequestException('File hoá đơn phải là PDF');
    if (files.xml && !files.xml.originalname.toLowerCase().endsWith('.xml'))
      throw new BadRequestException('File dữ liệu hoá đơn phải là XML');
    const options = {
      category: DocumentCategory.INVOICE,
      contractId: invoice.contractId,
      note: `Hoá đơn ${identity.symbol} số ${identity.number}`,
    };
    const ids: string[] = [];
    try {
      for (const file of [files.pdf, files.xml].filter(
        (f): f is UploadedFileInfo => !!f,
      ))
        ids.push(
          (
            await this.documents.upload(
              user,
              invoice.contract.customerId,
              file,
              options,
            )
          ).id,
        );
    } catch (error) {
      await this.dropFiles(user, ids);
      throw error;
    }
    return ids;
  }

  private async dropFiles(user: AuthUser, ids: string[]) {
    for (const id of ids) await this.documents.remove(user, id);
  }

  private async link(tx: Tx, invoiceId: string, documentIds: string[]) {
    if (documentIds.length)
      await tx.invoiceDocument.createMany({
        data: documentIds.map((documentId) => ({ invoiceId, documentId })),
      });
  }

  /** Ghi đè có kiểm `revision` và trạng thái hiện tại (K9): bản cũ → 409. */
  private async bump(
    tx: Tx,
    invoice: ScopedInvoice,
    revision: number,
    data: Prisma.InvoiceUncheckedUpdateManyInput,
  ) {
    const { count } = await tx.invoice.updateMany({
      where: { id: invoice.id, revision, status: invoice.status },
      data: { ...data, revision: { increment: 1 } },
    });
    if (!count) throw new ConflictException(CONFLICT);
  }

  private event(
    tx: Tx,
    invoice: ScopedInvoice,
    toStatus: InvoiceStatus,
    user: AuthUser,
    note: string,
  ) {
    return tx.invoiceEvent.create({
      data: {
        invoiceId: invoice.id,
        fromStatus: invoice.status,
        toStatus,
        note,
        actorId: user.id,
      },
    });
  }

  private requireStatus(
    invoice: ScopedInvoice,
    allowed: InvoiceStatus[],
    message: string,
  ) {
    if (!allowed.includes(invoice.status))
      throw new BadRequestException(
        `${message} (hiện: ${INVOICE_STATUS_LABEL[invoice.status]})`,
      );
  }

  private label(identity: {
    templateCode: string;
    symbol: string;
    number: string;
  }) {
    return `Đã xuất ${identity.templateCode}${identity.symbol} số ${identity.number}`;
  }

  private async findScoped(user: AuthUser, id: string): Promise<ScopedInvoice> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        contract: { AND: [contractScope(user), { deletedAt: null }] },
      },
      include: {
        contract: {
          select: { customerId: true, subtotal: true, vatRate: true },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Không tìm thấy hoá đơn');
    return invoice;
  }
}

type ScopedInvoice = Invoice & {
  contract: {
    customerId: string;
    subtotal: Prisma.Decimal;
    vatRate: Prisma.Decimal;
  };
};
