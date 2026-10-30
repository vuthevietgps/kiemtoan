import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CredentialEventType,
  CredentialStatus,
  TokenCustody,
} from '@prisma/client';
import { customerScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { CryptoService } from '../../core/crypto/crypto.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { toBusinessDate } from '../reports/utils/period.util';
import { ClientCredentialsQueryService } from './client-credentials-query.service';
import {
  CredentialEventInput,
  CredentialStore,
  isUniqueViolation,
  StoredCredential,
} from './credential-store';
import {
  changedFields,
  isToken,
  normalizeSerial,
  shapeError,
} from './credential.rules';
import {
  CreateClientCredentialDto,
  DeleteCredentialDto,
  ReportIssueDto,
  UpdateClientCredentialDto,
} from './dto/client-credential.dto';

const DUPLICATE_SERIAL = 'Số serial token này đã có trong kho';
const pick = <T>(value: T | undefined, old: T): T =>
  value === undefined ? old : value;
const dateOrNull = (value: string | null | undefined) =>
  value ? toBusinessDate(value) : null;

/**
 * Lệnh ghi tài khoản (đặc tả 09): thêm, sửa, đổi mật khẩu (L5), xoá mềm có lý do (L10), báo lỗi đăng
 * nhập (L7). Bắt buộc theo loại (L1, L2), chặn trùng serial, kiểm `revision`, mỗi thay đổi một sự kiện.
 */
@Injectable()
export class ClientCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly store: CredentialStore,
    private readonly query: ClientCredentialsQueryService,
  ) {}

  async create(user: AuthUser, dto: CreateClientCredentialDto) {
    await this.ensureCustomer(user, dto.customerId);
    const token = isToken(dto.type);
    const shape = {
      type: dto.type,
      label: dto.label ?? null,
      username: token ? null : (dto.username ?? null),
      expiresAt: dateOrNull(dto.expiresAt),
      provider: token ? (dto.provider ?? null) : null,
      serialNumber: token ? normalizeSerial(dto.serialNumber) : null,
    };
    this.ensureShape({ ...shape, hasSecret: !!dto.password });
    await this.store.ensureUniqueSerial(shape.provider, shape.serialNumber);
    const now = new Date();
    const created = await this.uniqueSerial(() =>
      this.prisma.$transaction(async (tx) => {
        const row = await tx.clientCredential.create({
          data: {
            ...shape,
            customerId: dto.customerId,
            url: dto.url ?? null,
            status: dto.status ?? CredentialStatus.ACTIVE,
            note: dto.note ?? null,
            custody: token ? (dto.custody ?? TokenCustody.OFFICE) : null,
            storageLocation: token ? (dto.storageLocation ?? null) : null,
            ...(dto.password && {
              passwordEnc: this.crypto.encrypt(dto.password),
              secretChangedAt: now,
              secretChangedById: user.id,
            }),
            updatedById: user.id,
          },
          select: { id: true },
        });
        await this.store.addEvents(tx, row.id, user.id, [
          { type: CredentialEventType.CREATED },
        ]);
        return row;
      }),
    );
    return this.query.findOne(user, created.id);
  }

  async update(user: AuthUser, id: string, dto: UpdateClientCredentialDto) {
    const found = await this.store.loadForWrite(user, id, dto.revision);
    if (dto.type && isToken(dto.type) !== isToken(found.type))
      throw new BadRequestException(
        'Không đổi được giữa chữ ký số và tài khoản cổng — hãy tạo mới',
      );
    const next = this.merge(found, dto);
    const secretChanged = !!dto.password;
    this.ensureShape({
      ...next,
      hasSecret: secretChanged || !!found.passwordEnc,
    });
    await this.store.ensureUniqueSerial(
      next.provider,
      next.serialNumber,
      found.id,
    );
    const events = this.updateEvents(found, next, secretChanged);
    if (!events.length) return this.query.findOne(user, id);
    const statusChanged = next.status !== found.status;
    await this.uniqueSerial(() =>
      this.store.commit(
        user,
        found,
        {
          ...next,
          ...(statusChanged && { statusNote: null }),
          ...(secretChanged && {
            passwordEnc: this.crypto.encrypt(dto.password as string),
            secretChangedAt: new Date(),
            secretChangedById: user.id,
          }),
        },
        events,
      ),
    );
    return this.query.findOne(user, id);
  }

  /** L10: xoá mềm có lý do; token đang mượn phải trả trước. */
  async remove(user: AuthUser, id: string, dto: DeleteCredentialDto) {
    const found = await this.store.loadForWrite(user, id, dto.revision);
    if (found.custody === TokenCustody.LOANED)
      throw new BadRequestException(
        'Token đang được mượn — cần trả lại trước khi xoá',
      );
    await this.store.commit(user, found, { deletedAt: new Date() }, [
      { type: CredentialEventType.DELETED, note: dto.reason },
    ]);
    return { id };
  }

  /** L7: người có quyền xem báo lỗi đăng nhập / cần đổi mật khẩu kèm ghi chú. */
  async reportIssue(user: AuthUser, id: string, dto: ReportIssueDto) {
    const found = await this.store.loadForWrite(user, id, dto.revision);
    await this.store.commit(
      user,
      found,
      { status: dto.status, statusNote: dto.note },
      [
        {
          type: CredentialEventType.STATUS_REPORTED,
          note: dto.note,
          detail: { from: found.status, to: dto.status },
        },
      ],
    );
    return this.query.findOne(user, id);
  }

  private merge(found: StoredCredential, dto: UpdateClientCredentialDto) {
    const type = dto.type ?? found.type;
    const token = isToken(type);
    return {
      type,
      label: pick(dto.label, found.label),
      url: pick(dto.url, found.url),
      username: token ? null : pick(dto.username, found.username),
      expiresAt:
        dto.expiresAt === undefined
          ? found.expiresAt
          : dateOrNull(dto.expiresAt),
      status: dto.status ?? found.status,
      note: pick(dto.note, found.note),
      provider: token ? pick(dto.provider, found.provider) : null,
      serialNumber: token
        ? dto.serialNumber === undefined
          ? found.serialNumber
          : normalizeSerial(dto.serialNumber)
        : null,
      storageLocation: token
        ? pick(dto.storageLocation, found.storageLocation)
        : null,
    };
  }

  private updateEvents(
    found: StoredCredential,
    next: ReturnType<ClientCredentialsService['merge']>,
    secretChanged: boolean,
  ): CredentialEventInput[] {
    const events: CredentialEventInput[] = [];
    const fields = changedFields(found, next).filter((f) => f !== 'status');
    if (fields.length)
      events.push({ type: CredentialEventType.UPDATED, detail: { fields } });
    if (next.status !== found.status)
      events.push({
        type: CredentialEventType.STATUS_CHANGED,
        detail: { from: found.status, to: next.status },
      });
    if (secretChanged)
      events.push({ type: CredentialEventType.SECRET_CHANGED });
    return events;
  }

  private ensureShape(shape: Parameters<typeof shapeError>[0]): void {
    const error = shapeError(shape);
    if (error) throw new BadRequestException(error);
  }

  /** Hai người lưu cùng serial cùng lúc: chỉ mục duy nhất chặn lượt sau → 409. */
  private async uniqueSerial<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(DUPLICATE_SERIAL);
      throw error;
    }
  }

  private async ensureCustomer(user: AuthUser, customerId: string) {
    const found = await this.prisma.customer.findFirst({
      where: {
        AND: [{ id: customerId, deletedAt: null }, customerScope(user)],
      },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Không tìm thấy khách hàng');
  }
}
