import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, toSkipTake } from '../../common/types/paginated';
import {
  customerScope,
  dataScopeOf,
} from '../../core/access-control/data-scope';
import { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  AssignCustomerDto,
  CreateContactDto,
  UpdateContactDto,
} from './dto/customer-relationship.dto';

export async function lockCustomer(
  tx: Prisma.TransactionClient,
  user: AuthUser,
  id: string,
) {
  await tx.$queryRaw`SELECT id FROM customers WHERE id = ${id}::uuid FOR UPDATE`;
  const customer = await tx.customer.findFirst({
    where: { AND: [{ id, deletedAt: null }, customerScope(user)] },
    select: { id: true },
  });
  if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
}

export async function syncPrimaryContact(
  tx: Prisma.TransactionClient,
  customerId: string,
) {
  const contact = await tx.customerContact.findFirst({
    where: { customerId, deletedAt: null, isPrimary: true },
  });
  await tx.customer.update({
    where: { id: customerId },
    data: {
      contactName: contact?.fullName ?? null,
      contactEmail: contact?.email ?? null,
      contactPhone: contact?.phone ?? null,
    },
  });
}

@Injectable()
export class CustomerRelationshipsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureCustomer(user: AuthUser, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        AND: [{ id: customerId, deletedAt: null }, customerScope(user)],
      },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
  }

  async contacts(
    user: AuthUser,
    customerId: string,
    query: PaginationQueryDto,
  ) {
    await this.ensureCustomer(user, customerId);
    const where: Prisma.CustomerContactWhereInput = {
      customerId,
      deletedAt: null,
      ...(query.search && {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customerContact.findMany({
        where,
        orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.customerContact.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  saveContact(
    user: AuthUser,
    customerId: string,
    dto: CreateContactDto | UpdateContactDto,
    id?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, user, customerId);
      const before = id
        ? await tx.customerContact.findFirst({
            where: { id, customerId, deletedAt: null },
          })
        : null;
      if (id && !before)
        throw new NotFoundException('Không tìm thấy người liên hệ');
      if (dto.isPrimary)
        await tx.customerContact.updateMany({
          where: { customerId, isPrimary: true, deletedAt: null },
          data: { isPrimary: false },
        });
      const result = id
        ? await tx.customerContact.update({ where: { id }, data: dto })
        : await tx.customerContact.create({
            data: {
              ...dto,
              fullName: (dto as CreateContactDto).fullName,
              customerId,
              createdById: user.id,
            },
          });
      await syncPrimaryContact(tx, customerId);
      await this.audit(
        tx,
        user,
        customerId,
        id ? 'CONTACT_UPDATE' : 'CONTACT_CREATE',
        before,
        result,
      );
      return result;
    });
  }

  removeContact(user: AuthUser, customerId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, user, customerId);
      const before = await tx.customerContact.findFirst({
        where: { id, customerId, deletedAt: null },
      });
      if (!before) throw new NotFoundException('Không tìm thấy người liên hệ');
      await tx.customerContact.update({
        where: { id },
        data: { deletedAt: new Date(), isPrimary: false },
      });
      await syncPrimaryContact(tx, customerId);
      await this.audit(tx, user, customerId, 'CONTACT_DELETE', before, { id });
      return { id };
    });
  }

  async assignments(
    user: AuthUser,
    customerId: string,
    query: PaginationQueryDto,
  ) {
    await this.ensureCustomer(user, customerId);
    const where = { customerId, deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customerAssignment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              isActive: true,
              leftAt: true,
              teamId: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.customerAssignment.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  assign(user: AuthUser, customerId: string, dto: AssignCustomerDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, user, customerId);
      await assertCustomerAssignee(tx, user, dto.userId);
      const before = await tx.customerAssignment.findUnique({
        where: { customerId_userId: { customerId, userId: dto.userId } },
      });
      const result = await tx.customerAssignment.upsert({
        where: { customerId_userId: { customerId, userId: dto.userId } },
        create: { ...dto, customerId, assignedById: user.id },
        update: {
          note: dto.note,
          assignedById: user.id,
          deletedAt: null,
          createdAt: before?.deletedAt ? new Date() : undefined,
        },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      });
      await this.audit(tx, user, customerId, 'CUSTOMER_ASSIGN', before, result);
      return result;
    });
  }

  unassign(user: AuthUser, customerId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, user, customerId);
      const before = await tx.customerAssignment.findFirst({
        where: { id, customerId, deletedAt: null },
      });
      if (!before) throw new NotFoundException('Không tìm thấy phân công');
      if (dataScopeOf(user) !== 'ALL') {
        const assignee = await tx.user.findFirst({
          where: {
            id: before.userId,
            ...(dataScopeOf(user) === 'TEAM'
              ? { teamId: user.teamId }
              : { id: user.id }),
          },
          select: { id: true },
        });
        if (!assignee)
          throw new BadRequestException(
            'Không được gỡ phân công ngoài phạm vi quản lý',
          );
      }
      await tx.customerAssignment.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.audit(tx, user, customerId, 'CUSTOMER_UNASSIGN', before, {
        id,
      });
      return { id };
    });
  }

  private async audit(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    customerId: string,
    action: string,
    before: unknown,
    after: unknown,
  ) {
    // Không lưu nội dung liên hệ rõ vào nhật ký, chỉ mã bản ghi và tên trường thay đổi.
    const metadata = (value: unknown) =>
      value && typeof value === 'object'
        ? {
            id: (value as { id?: string }).id,
            fields: Object.keys(value).sort(),
          }
        : null;
    await tx.auditLog.create({
      data: {
        userId: user.id,
        entity: 'customers',
        entityId: customerId,
        action,
        detail: { before: metadata(before), after: metadata(after) },
      },
    });
  }
}

export async function assertCustomerAssignee(
  tx: Pick<Prisma.TransactionClient, 'user'>,
  actor: AuthUser,
  id: string,
) {
  const scope = dataScopeOf(actor);
  const found = await tx.user.findFirst({
    where: {
      id,
      deletedAt: null,
      isActive: true,
      leftAt: null,
      ...(scope === 'TEAM'
        ? { teamId: actor.teamId }
        : scope === 'ALL'
          ? {}
          : { id: actor.id }),
      role: { not: 'ADMIN' },
    },
    select: { id: true },
  });
  if (!found || (scope !== 'ALL' && scope !== 'TEAM' && id !== actor.id))
    throw new BadRequestException(
      'Người phụ trách phải đang hoạt động và thuộc phạm vi quản lý',
    );
}
