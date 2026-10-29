import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomerStatus, Prisma, TaxPeriod } from '@prisma/client';
import { customerSearch } from './customer-query.util';
import { customerScope } from '../../core/access-control/data-scope';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { assertCustomerAssignee } from './customer-relationships.service';
import { CreateCustomerDto, CustomerQueryDto } from './dto/customer.dto';
import {
  readCustomerWorkbook,
  writeCustomerWorkbook,
} from './customer-workbook.util';

export interface ImportRow {
  row: number;
  input: CreateCustomerDto;
  ownerEmail: string;
  errors: string[];
}

@Injectable()
export class CustomerImportService {
  constructor(private readonly prisma: PrismaService) {}

  template() {
    return writeCustomerWorkbook([], true);
  }

  async preview(user: AuthUser, buffer: Buffer | undefined) {
    if (!buffer) throw new BadRequestException('Vui lòng chọn file XLSX');
    const values = await readCustomerWorkbook(buffer);
    const rows: ImportRow[] = [];
    for (const [index, valuesRow] of values.entries()) {
      if (valuesRow.every((value) => !value)) continue;
      const [
        name,
        taxCode,
        address,
        legalRep,
        businessType,
        taxPeriod,
        status,
        contactName,
        contactPhone,
        contactEmail,
        ownerEmail,
        note,
        fiscalYearEndMonth,
        vatMethod,
        pitPeriod,
        accountingRegime,
        taxAuthority,
      ] = valuesRow;
      const input = plainToInstance(CreateCustomerDto, {
        name,
        taxCode,
        address: address || undefined,
        legalRep: legalRep || undefined,
        businessType: businessType || undefined,
        taxPeriod: taxPeriod || 'MONTHLY',
        status: status || 'ACTIVE',
        contactName: contactName || undefined,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        note: note || undefined,
        fiscalYearEndMonth: fiscalYearEndMonth || undefined,
        vatMethod: vatMethod || undefined,
        pitPeriod: pitPeriod || undefined,
        accountingRegime: accountingRegime || undefined,
        taxAuthority: taxAuthority || undefined,
      });
      const errors = (
        await validate(input, { whitelist: true, forbidNonWhitelisted: true })
      ).flatMap((error) => Object.values(error.constraints ?? {}));
      rows.push({
        row: index + 2,
        input,
        ownerEmail: ownerEmail.toLowerCase(),
        errors,
      });
    }
    if (!rows.length)
      throw new BadRequestException('File chưa có khách hàng để nhập');
    await this.validateRows(this.prisma, user, rows);
    const batch = await this.prisma.customerImportBatch.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        payload: JSON.parse(JSON.stringify(rows)) as Prisma.InputJsonValue,
      },
    });
    return {
      id: batch.id,
      expiresAt: batch.expiresAt,
      rows,
      validCount: rows.filter((row) => !row.errors.length).length,
      invalidCount: rows.filter((row) => row.errors.length).length,
    };
  }

  confirm(user: AuthUser, id: string, selected: number[]) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM customer_import_batches WHERE id = ${id}::uuid FOR UPDATE`;
        const batch = await tx.customerImportBatch.findFirst({
          where: { id, userId: user.id },
        });
        if (!batch) throw new NotFoundException('Không tìm thấy bản xem trước');
        if (batch.usedAt || batch.expiresAt <= new Date())
          throw new ConflictException('Bản xem trước đã sử dụng hoặc hết hạn');
        const rows = batch.payload as unknown as ImportRow[];
        const chosen = rows.filter((row) => selected.includes(row.row));
        if (
          chosen.length !== selected.length ||
          chosen.some((row) => row.errors.length)
        )
          throw new BadRequestException(
            'Chỉ xác nhận các dòng hợp lệ trong bản xem trước',
          );
        await this.validateRows(tx, user, chosen);
        if (chosen.some((row) => row.errors.length))
          throw new ConflictException(
            'Dữ liệu hoặc quyền đã thay đổi. Vui lòng xem trước lại',
          );
        const ids: string[] = [];
        for (const row of chosen) {
          const { contactName, contactPhone, contactEmail } = row.input;
          const customer = await tx.customer.create({
            data: {
              ...row.input,
              createdById: user.id,
              taxPeriod: row.input.taxPeriod as TaxPeriod,
              status: row.input.status as CustomerStatus,
              ...((contactName || contactPhone || contactEmail) && {
                contacts: {
                  create: {
                    fullName: contactName || row.input.name,
                    phone: contactPhone,
                    email: contactEmail,
                    isPrimary: true,
                    createdById: user.id,
                  },
                },
              }),
            },
            select: { id: true },
          });
          ids.push(customer.id);
        }
        await tx.customerImportBatch.update({
          where: { id },
          data: { usedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'CUSTOMERS_IMPORT',
            entity: 'customers',
            entityId: id,
            detail: { count: ids.length, customerIds: ids },
          },
        });
        return { count: ids.length, ids };
      },
      { timeout: 30000 },
    );
  }

  private async validateRows(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    rows: ImportRow[],
  ) {
    const existing = await tx.customer.findMany({
      where: { taxCode: { in: rows.map((row) => row.input.taxCode) } },
      select: { taxCode: true },
    });
    const duplicates = new Set(existing.map((customer) => customer.taxCode));
    const counts = new Map<string, number>();
    rows.forEach((row) =>
      counts.set(row.input.taxCode, (counts.get(row.input.taxCode) ?? 0) + 1),
    );
    for (const row of rows) {
      if (duplicates.has(row.input.taxCode))
        row.errors.push('Mã số thuế đã tồn tại trong hệ thống');
      if ((counts.get(row.input.taxCode) ?? 0) > 1)
        row.errors.push('Mã số thuế trùng trong file');
      const owner = row.ownerEmail
        ? await tx.user.findUnique({
            where: { email: row.ownerEmail },
            select: { id: true },
          })
        : { id: user.id };
      if (!owner) {
        row.errors.push('Không tìm thấy email người phụ trách');
        continue;
      }
      try {
        await assertCustomerAssignee(tx, user, owner.id);
        row.input.ownerId = owner.id;
      } catch {
        row.errors.push(
          'Người phụ trách ngừng hoạt động hoặc ngoài phạm vi quản lý',
        );
      }
    }
  }

  async export(user: AuthUser, query: CustomerQueryDto) {
    const where: Prisma.CustomerWhereInput = {
      AND: [
        { deletedAt: null },
        customerScope(user),
        {
          status: query.status,
          ownerId: query.ownerId,
          ...customerSearch(query.search),
        },
      ],
    };
    const customers = await this.prisma.customer.findMany({
      where,
      take: 10001,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: { owner: { select: { email: true } } },
    });
    if (customers.length > 10000)
      throw new BadRequestException(
        'Tối đa 10.000 khách hàng mỗi lần xuất; vui lòng thu hẹp bộ lọc',
      );
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CUSTOMERS_EXPORT',
        entity: 'customers',
        detail: { count: customers.length },
      },
    });
    return writeCustomerWorkbook(
      customers.map((customer) => [
        customer.name,
        customer.taxCode,
        customer.address ?? '',
        customer.legalRep ?? '',
        customer.businessType ?? '',
        customer.taxPeriod,
        customer.status,
        customer.contactName ?? '',
        customer.contactPhone ?? '',
        customer.contactEmail ?? '',
        customer.owner?.email ?? '',
        customer.note ?? '',
        String(customer.fiscalYearEndMonth),
        customer.vatMethod ?? '',
        customer.pitPeriod ?? '',
        customer.accountingRegime ?? '',
        customer.taxAuthority ?? '',
      ]),
    );
  }
}
