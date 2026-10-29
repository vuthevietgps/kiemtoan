import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, toSkipTake } from '../../common/types/paginated';
import { customerScope } from '../../core/access-control/data-scope';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { CryptoService } from '../../core/crypto/crypto.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  ClientCredentialQueryDto,
  CreateClientCredentialDto,
  UpdateClientCredentialDto,
} from './dto/client-credential.dto';

/** Trường được phép trả ra ngoài — tuyệt đối không có passwordEnc. */
export const CREDENTIAL_PUBLIC_SELECT = {
  id: true,
  customerId: true,
  type: true,
  label: true,
  url: true,
  username: true,
  expiresAt: true,
  status: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true, taxCode: true } },
  updatedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ClientCredentialSelect;

@Injectable()
export class ClientCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  private scoped(
    user: AuthUser,
    extra: Prisma.ClientCredentialWhereInput = {},
  ): Prisma.ClientCredentialWhereInput {
    return {
      deletedAt: null,
      customer: { AND: [{ deletedAt: null }, customerScope(user)] },
      ...extra,
    };
  }

  async findAll(user: AuthUser, query: ClientCredentialQueryDto) {
    const where = this.scoped(user, {
      customerId: query.customerId,
      type: query.type,
      ...(query.search && {
        OR: [
          { username: { contains: query.search, mode: 'insensitive' } },
          { label: { contains: query.search, mode: 'insensitive' } },
          {
            customer: {
              name: { contains: query.search, mode: 'insensitive' },
            },
          },
        ],
      }),
    });
    const [items, total] = await this.prisma.$transaction([
      this.prisma.clientCredential.findMany({
        where,
        select: CREDENTIAL_PUBLIC_SELECT,
        orderBy: [{ customer: { name: 'asc' } }, { type: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.clientCredential.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async create(user: AuthUser, dto: CreateClientCredentialDto) {
    await this.ensureCustomer(user, dto.customerId);
    const { password, expiresAt, ...data } = dto;
    return this.prisma.clientCredential.create({
      data: {
        ...data,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        passwordEnc: this.crypto.encrypt(password),
        updatedById: user.id,
      },
      select: CREDENTIAL_PUBLIC_SELECT,
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateClientCredentialDto) {
    await this.findInScope(user, id);
    const { password, expiresAt, ...data } = dto;
    return this.prisma.clientCredential.update({
      where: { id },
      data: {
        ...data,
        // null = xoá ngày hết hạn; không gửi = giữ nguyên
        ...(expiresAt !== undefined && {
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        }),
        ...(password && { passwordEnc: this.crypto.encrypt(password) }),
        updatedById: user.id,
      },
      select: CREDENTIAL_PUBLIC_SELECT,
    });
  }

  async remove(user: AuthUser, id: string) {
    await this.findInScope(user, id);
    return this.prisma.clientCredential.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: user.id },
      select: { id: true },
    });
  }

  /** Giải mã mật khẩu — luôn ghi nhật ký ai xem, lúc nào. */
  async reveal(user: AuthUser, id: string): Promise<{ password: string }> {
    const found = await this.findInScope(user, id);
    const password = this.crypto.decrypt(found.passwordEnc);
    await this.audit.log(user.id, 'VIEW_SECRET', 'client-credentials', id);
    return { password };
  }

  private async findInScope(user: AuthUser, id: string) {
    const found = await this.prisma.clientCredential.findFirst({
      where: this.scoped(user, { id }),
      select: { id: true, passwordEnc: true },
    });
    if (!found) throw new NotFoundException('Không tìm thấy tài khoản');
    return found;
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
