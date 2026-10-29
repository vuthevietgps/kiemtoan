import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, toSkipTake } from '../../common/types/paginated';
import { PrismaService } from '../../core/prisma/prisma.service';
import { periodMoments, toBusinessDate } from '../reports/utils/period.util';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { xlsxWorkbook } from '../../common/types/xlsx-workbook';

/** Xem nhật ký hoạt động (chỉ đọc — nhật ký do AuditService/interceptor ghi). */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AuditLogQueryDto) {
    const where = this.filter(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
        ...toSkipTake(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async export(query: AuditLogQueryDto): Promise<Buffer> {
    const rows = await this.prisma.auditLog.findMany({
      where: this.filter(query),
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { fullName: true, email: true } } },
      take: 10001,
    });
    if (rows.length > 10000)
      throw new BadRequestException(
        'Tối đa 10.000 bản ghi mỗi lần xuất. Vui lòng thu hẹp bộ lọc.',
      );
    return xlsxWorkbook([
      [
        'Thời điểm UTC',
        'Người thực hiện',
        'Email',
        'Hành động',
        'Module',
        'Mã đối tượng',
        'Chi tiết',
      ],
      ...rows.map((row) => [
        row.createdAt.toISOString(),
        row.user?.fullName ?? '',
        row.user?.email ?? '',
        row.action,
        row.entity,
        row.entityId ?? '',
        JSON.stringify(row.detail ?? {}),
      ]),
    ]);
  }

  private filter(query: AuditLogQueryDto): Prisma.AuditLogWhereInput {
    const createdAt = this.createdAtFilter(query.from, query.to);
    return {
      userId: query.userId,
      entity: query.entity,
      action: query.action,
      ...(createdAt && { createdAt }),
      ...(query.search && {
        OR: [
          { entityId: { contains: query.search, mode: 'insensitive' } },
          {
            user: {
              fullName: { contains: query.search, mode: 'insensitive' },
            },
          },
        ],
      }),
    };
  }

  /** Các module đã có nhật ký, dùng cho bộ lọc. */
  async entities(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['entity'],
      select: { entity: true },
      orderBy: { entity: 'asc' },
    });
    return rows.map((r) => r.entity);
  }

  /** Lọc theo ngày giờ Việt Nam, hai đầu đều tính. */
  private createdAtFilter(
    from?: string,
    to?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    const filter: Prisma.DateTimeFilter = {};
    if (from) {
      const d = toBusinessDate(from);
      filter.gte = periodMoments({ from: d, to: d }).gte;
    }
    if (to) {
      const d = toBusinessDate(to);
      filter.lt = periodMoments({ from: d, to: d }).lt;
    }
    return filter;
  }
}
