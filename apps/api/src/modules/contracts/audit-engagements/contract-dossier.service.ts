import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  AcceptanceStatus,
  ClientDeliveryStatus,
  ContractStatus,
  OriginalFilingStatus,
  Prisma,
} from '@prisma/client';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ContractDossierDto } from '../dto/audit-engagement.dto';
import { vietnamToday } from '../lifecycle/renewal.util';
import {
  AuditEngagementsQuery,
  DOSSIER_SELECT,
  dossierView,
} from './audit-engagements.query';

const UNAPPROVED: ContractStatus[] = [
  ContractStatus.DRAFT,
  ContractStatus.PENDING_APPROVAL,
];
const DRAFT_DELIVERY: ClientDeliveryStatus[] = [
  ClientDeliveryStatus.NOT_SENT,
  ClientDeliveryStatus.SOFT_COPY,
];

type DossierData = Pick<
  Prisma.ContractUncheckedUpdateInput,
  | 'clientDeliveryStatus'
  | 'clientDeliveredAt'
  | 'originalFilingStatus'
  | 'originalFiledAt'
  | 'originalFilingNote'
  | 'acceptanceStatus'
  | 'acceptanceSignedAt'
  | 'acceptanceDocumentId'
>;

/**
 * Tình trạng hồ sơ HĐ (đặc tả 04-F): gửi HĐ cho khách, lưu bản gốc, biên bản nghiệm thu. BBNT
 * "Đã ký" phải gắn bản đã ký loại Biên bản nghiệm thu của chính HĐ (F8).
 */
@Injectable()
export class ContractDossierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: AuditEngagementsQuery,
  ) {}

  async update(user: AuthUser, contractId: string, dto: ContractDossierDto) {
    const contract = await this.query.load(user, contractId);
    if (contract.status === ContractStatus.CANCELLED)
      throw new BadRequestException('Hợp đồng đã huỷ, chỉ xem được');
    const data = this.normalize(dto);
    if (UNAPPROVED.includes(contract.status)) this.ensureDraftAllowed(dto);
    if (dto.acceptanceStatus === AcceptanceStatus.SIGNED)
      await this.ensureSignedAcceptance(contractId, dto.acceptanceDocumentId);
    if (contract.dossierRevision !== dto.revision)
      throw new ConflictException(
        'Tình trạng hồ sơ đã được người khác cập nhật, tải lại để xem',
      );
    const before = dossierView(contract);
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.contract.updateMany({
        where: { id: contractId, dossierRevision: dto.revision },
        data: { ...data, dossierRevision: { increment: 1 } },
      });
      if (!done.count)
        throw new ConflictException(
          'Tình trạng hồ sơ đã được người khác cập nhật, tải lại để xem',
        );
      const after = dossierView(await this.reload(tx, contractId));
      const fields = DOSSIER_FIELDS.filter(
        (f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]),
      );
      if (fields.length)
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'DOSSIER_UPDATE',
            entity: 'contracts',
            entityId: contractId,
            detail: {
              fields,
              before: pick(before, fields),
              after: pick(after, fields),
            },
          },
        });
    });
    return this.query.get(user, contractId);
  }

  /** Bỏ ngày/tài liệu không còn ý nghĩa với trạng thái đã chọn; bắt buộc ngày khi đã gửi/lưu/ký. */
  private normalize(dto: ContractDossierDto): DossierData {
    const today = vietnamToday();
    const date = (value: string | null | undefined, label: string) => {
      if (!value) throw new BadRequestException(`Vui lòng chọn ${label}`);
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime()))
        throw new BadRequestException(`${label} không hợp lệ`);
      if (parsed > today)
        throw new BadRequestException(`${label} không được sau hôm nay`);
      return parsed;
    };
    const sent = dto.clientDeliveryStatus !== ClientDeliveryStatus.NOT_SENT;
    const filed = dto.originalFilingStatus === OriginalFilingStatus.FILED;
    const signed = dto.acceptanceStatus === AcceptanceStatus.SIGNED;
    return {
      clientDeliveryStatus: dto.clientDeliveryStatus,
      clientDeliveredAt: sent
        ? date(dto.clientDeliveredAt, 'ngày gửi hợp đồng')
        : null,
      originalFilingStatus: dto.originalFilingStatus,
      originalFiledAt: filed
        ? date(dto.originalFiledAt, 'ngày lưu bản gốc')
        : null,
      originalFilingNote:
        dto.originalFilingStatus === OriginalFilingStatus.NOT_FILED
          ? null
          : dto.originalFilingNote?.trim() || null,
      acceptanceStatus: dto.acceptanceStatus,
      acceptanceSignedAt: signed
        ? date(dto.acceptanceSignedAt, 'ngày ký biên bản nghiệm thu')
        : null,
      acceptanceDocumentId: signed ? dto.acceptanceDocumentId! : null,
    };
  }

  private ensureDraftAllowed(dto: ContractDossierDto) {
    if (
      !DRAFT_DELIVERY.includes(dto.clientDeliveryStatus) ||
      dto.originalFilingStatus !== OriginalFilingStatus.NOT_FILED ||
      dto.acceptanceStatus !== AcceptanceStatus.NONE
    )
      throw new BadRequestException(
        'Hợp đồng chưa duyệt chỉ ghi được đã gửi bản mềm dự thảo',
      );
  }

  private async ensureSignedAcceptance(
    contractId: string,
    contractDocumentId: string | null | undefined,
  ) {
    const found =
      contractDocumentId &&
      (await this.prisma.contractDocument.count({
        where: {
          id: contractDocumentId,
          contractId,
          type: 'ACCEPTANCE',
          source: 'SIGNED',
          document: { deletedAt: null },
        },
      }));
    if (!found)
      throw new BadRequestException(
        'Biên bản nghiệm thu "Đã ký" cần chọn bản đã ký loại Biên bản nghiệm thu của hợp đồng này',
      );
  }

  private reload(tx: Prisma.TransactionClient, id: string) {
    return tx.contract.findUniqueOrThrow({
      where: { id },
      select: DOSSIER_SELECT,
    });
  }
}

const DOSSIER_FIELDS = [
  'clientDeliveryStatus',
  'clientDeliveredAt',
  'originalFilingStatus',
  'originalFiledAt',
  'originalFilingNote',
  'acceptanceStatus',
  'acceptanceSignedAt',
  'acceptanceDocument',
] as const;

function pick(
  source: ReturnType<typeof dossierView>,
  fields: readonly string[],
): Prisma.InputJsonObject {
  return Object.fromEntries(
    fields.map((f) => [
      f,
      source[f as keyof typeof source] as Prisma.InputJsonValue | null,
    ]),
  );
}
