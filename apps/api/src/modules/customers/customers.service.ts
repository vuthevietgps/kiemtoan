import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  CUSTOMER_TAX_PROFILE_CHANGED,
  type CustomerTaxProfileChangedEvent,
} from '../../common/events/app-events';
import { paginated, toSkipTake } from '../../common/types/paginated';
import {
  customerScope,
  dataScopeOf,
  taskScope,
} from '../../core/access-control/data-scope';
import { hasPermission } from '../../core/access-control/permissions';
import { customerSearch } from './customer-query.util';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  assertCustomerAssignee,
  lockCustomer,
} from './customer-relationships.service';
import {
  CreateCustomerDto,
  CustomerQueryDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

const OWNER_SELECT = { select: { id: true, fullName: true } } as const;

/** Trường mà lịch báo cáo (06, I4–I5) phụ thuộc: đổi thì đồng bộ lại. */
const TAX_PROFILE_KEYS = [
  'status',
  'taxPeriod',
  'fiscalYearEndMonth',
  'vatMethod',
  'pitPeriod',
  'accountingRegime',
] as const;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Điều kiện gốc: chưa xoá + trong phạm vi dữ liệu của người dùng. */
  private scoped(
    user: AuthUser,
    extra: Prisma.CustomerWhereInput = {},
  ): Prisma.CustomerWhereInput {
    return { AND: [{ deletedAt: null }, customerScope(user), extra] };
  }

  async findAll(user: AuthUser, query: CustomerQueryDto) {
    const where = this.scoped(user, {
      status: query.status,
      ownerId: query.ownerId,
      ...customerSearch(query.search),
    });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: {
          owner: OWNER_SELECT,
          _count: { select: { contracts: { where: { deletedAt: null } } } },
        },
        orderBy: { name: 'asc' },
        ...toSkipTake(query),
      }),
      this.prisma.customer.count({ where }),
    ]);
    const items = rows.map(({ _count, ...c }) => ({
      ...c,
      contractCount: _count.contracts,
    }));
    return paginated(items, total, query);
  }

  /** Dạng gọn cho ô chọn khách hàng ở các module khác — giữ nguyên dạng {id, name, taxCode}. */
  options(user: AuthUser) {
    return this.prisma.customer.findMany({
      where: this.scoped(user),
      select: { id: true, name: true, taxCode: true },
      orderBy: { name: 'asc' },
    });
  }

  async assigneeOptions(user: AuthUser, query: CustomerQueryDto) {
    const scope = dataScopeOf(user);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      isActive: true,
      leftAt: null,
      role: { not: 'ADMIN' },
      ...(scope === 'ALL'
        ? {}
        : scope === 'TEAM'
          ? { teamId: user.teamId }
          : { id: user.id }),
      ...(query.search && {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: { id: true, fullName: true, email: true, role: true },
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async findOne(user: AuthUser, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: this.scoped(user, { id }),
      include: {
        owner: OWNER_SELECT,
        tasks: hasPermission(user, 'tasks', 'view')
          ? {
              where: {
                AND: [
                  { deletedAt: null, status: { not: 'COMPLETED' } },
                  taskScope(user),
                ],
              },
              select: { id: true, title: true, status: true, dueDate: true },
              orderBy: { dueDate: 'asc' },
              take: 5,
            }
          : false,
        contracts: {
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            status: true,
            total: true,
            startDate: true,
          },
          orderBy: { startDate: 'desc' },
        },
        _count: {
          select: {
            documents: { where: { deletedAt: null } },
            tasks: {
              where: {
                AND: [
                  { deletedAt: null, status: { not: 'COMPLETED' } },
                  taskScope(user),
                ],
              },
            },
          },
        },
      },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
    const { _count, ...rest } = customer;
    return {
      ...rest,
      contracts: hasPermission(user, 'contracts', 'view') ? rest.contracts : [],
      documentCount: hasPermission(user, 'documents', 'view')
        ? _count.documents
        : undefined,
      openTaskCount: hasPermission(user, 'tasks', 'view')
        ? _count.tasks
        : undefined,
    };
  }

  async create(user: AuthUser, dto: CreateCustomerDto) {
    await this.assertTaxCodeFree(dto.taxCode);
    const ownerId = dto.ownerId ?? user.id;
    await assertCustomerAssignee(this.prisma, user, ownerId);
    return this.prisma.customer.create({
      data: {
        ...dto,
        ownerId,
        createdById: user.id,
        ...((dto.contactName || dto.contactEmail || dto.contactPhone) && {
          contacts: {
            create: {
              fullName: dto.contactName || dto.name,
              phone: dto.contactPhone,
              email: dto.contactEmail,
              isPrimary: true,
              createdById: user.id,
            },
          },
        }),
      },
      include: { owner: OWNER_SELECT },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateCustomerDto) {
    if ('ownerId' in dto && dto.ownerId == null)
      throw new BadRequestException('Vui lòng chọn người phụ trách');
    const current = await this.ensureInScope(user, id);
    if (dto.taxCode && dto.taxCode !== current.taxCode) {
      await this.assertTaxCodeFree(dto.taxCode);
    }
    if (dto.ownerId)
      await assertCustomerAssignee(this.prisma, user, dto.ownerId);
    const updated = await this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, user, id);
      const result = await tx.customer.update({
        where: { id },
        data: dto,
        include: { owner: OWNER_SELECT },
      });
      if (
        ['contactName', 'contactEmail', 'contactPhone'].some(
          (key) => key in dto,
        )
      ) {
        const primary = await tx.customerContact.findFirst({
          where: { customerId: id, isPrimary: true, deletedAt: null },
        });
        const data = {
          fullName: result.contactName || result.name,
          phone: result.contactPhone,
          email: result.contactEmail,
        };
        if (
          primary &&
          !result.contactName &&
          !result.contactPhone &&
          !result.contactEmail
        )
          await tx.customerContact.update({
            where: { id: primary.id },
            data: { isPrimary: false, deletedAt: new Date() },
          });
        else if (primary)
          await tx.customerContact.update({ where: { id: primary.id }, data });
        else if (
          result.contactName ||
          result.contactPhone ||
          result.contactEmail
        )
          await tx.customerContact.create({
            data: {
              ...data,
              customerId: id,
              isPrimary: true,
              createdById: user.id,
            },
          });
      }
      if (dto.ownerId && dto.ownerId !== current.ownerId)
        await tx.auditLog.create({
          data: {
            userId: user.id,
            entity: 'customers',
            entityId: id,
            action: 'CUSTOMER_OWNER_CHANGE',
            detail: {
              before: { ownerId: current.ownerId },
              after: { ownerId: dto.ownerId },
            },
          },
        });
      return result;
    });
    if (TAX_PROFILE_KEYS.some((key) => key in dto)) {
      const event: CustomerTaxProfileChangedEvent = {
        customerId: id,
        actorId: user.id,
      };
      await this.events.emitAsync(CUSTOMER_TAX_PROFILE_CHANGED, event);
    }
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    await this.ensureInScope(user, id);
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
  }

  private async ensureInScope(user: AuthUser, id: string) {
    const found = await this.prisma.customer.findFirst({
      where: this.scoped(user, { id }),
      select: { id: true, taxCode: true, ownerId: true },
    });
    if (!found) throw new NotFoundException('Không tìm thấy khách hàng');
    return found;
  }

  private async assertTaxCodeFree(taxCode: string): Promise<void> {
    const exists = await this.prisma.customer.findUnique({
      where: { taxCode },
      select: { id: true },
    });
    if (exists) throw new ConflictException('Mã số thuế đã tồn tại');
  }
}
