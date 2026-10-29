import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CalendarDayKind, CalendarYearStatus } from '@prisma/client';
import { hasPermission } from '../../core/access-control/permissions';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  formatBusinessDate,
  toBusinessDate,
} from '../reports/utils/period.util';
import { RevisionDto, SaveCalendarDaysDto } from './dto/deadlines.dto';
import { ObligationEngine } from './obligation-engine.service';

const CONFLICT =
  'Lịch năm vừa được người khác sửa hoặc xác nhận; vui lòng tải lại';

/** Lịch làm việc theo năm (đặc tả 06, I2): nhập ngày nghỉ/làm bù, Giám đốc xác nhận. */
@Injectable()
export class BusinessCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly engine: ObligationEngine,
  ) {}

  async get(year: number) {
    assertYear(year);
    const row = await this.prisma.businessCalendarYear.findUnique({
      where: { year },
      include: { days: { orderBy: { date: 'asc' } } },
    });
    return {
      year,
      status: row?.status ?? CalendarYearStatus.DRAFT,
      revision: row?.revision ?? null,
      confirmedAt: row?.confirmedAt ?? null,
      confirmedById: row?.confirmedById ?? null,
      days: (row?.days ?? []).map((d) => ({
        date: formatBusinessDate(d.date),
        kind: d.kind,
        name: d.name,
      })),
    };
  }

  /**
   * Ghi lại toàn bộ ngày của năm. Năm đã xác nhận: chỉ người có `deadlines:approve`, bắt buộc lý do,
   * rồi tính lại hạn (I8).
   */
  async saveDays(user: AuthUser, year: number, dto: SaveCalendarDaysDto) {
    assertYear(year);
    const days = validateDays(year, dto);
    const current = await this.prisma.businessCalendarYear.findUnique({
      where: { year },
    });
    const confirmed = current?.status === CalendarYearStatus.CONFIRMED;
    if (confirmed && !hasPermission(user, 'deadlines', 'approve'))
      throw new ForbiddenException(
        'Lịch năm đã xác nhận; chỉ Giám đốc được sửa',
      );
    if (confirmed && !dto.reason)
      throw new BadRequestException('Sửa lịch đã xác nhận cần ghi lý do');
    await this.prisma.$transaction(async (tx) => {
      if (current) {
        const { count } = await tx.businessCalendarYear.updateMany({
          where: { year, revision: dto.revision ?? -1 },
          data: { revision: { increment: 1 } },
        });
        if (!count) throw new ConflictException(CONFLICT);
      } else {
        await tx.businessCalendarYear.create({ data: { year } }).catch(() => {
          throw new ConflictException(CONFLICT);
        });
      }
      await tx.businessCalendarDay.deleteMany({ where: { year } });
      await tx.businessCalendarDay.createMany({
        data: days.map((d) => ({ ...d, year, createdById: user.id })),
      });
    });
    await this.audit.log(user.id, 'CALENDAR_SAVE', 'deadlines', String(year), {
      year,
      days: days.length,
      ...(dto.reason && { reason: dto.reason }),
    });
    const changedDues = confirmed
      ? await this.engine.recalculate(
          user.id,
          `Lịch làm việc năm ${year} thay đổi: ${dto.reason}`,
        )
      : 0;
    return { ...(await this.get(year)), changedDues };
  }

  async confirm(user: AuthUser, year: number, dto: RevisionDto) {
    assertYear(year);
    const current = await this.prisma.businessCalendarYear.findUnique({
      where: { year },
    });
    if (!current)
      throw new NotFoundException('Năm chưa có lịch; hãy nhập ngày nghỉ trước');
    const { count } = await this.prisma.businessCalendarYear.updateMany({
      where: {
        year,
        status: CalendarYearStatus.DRAFT,
        revision: dto.revision,
      },
      data: {
        status: CalendarYearStatus.CONFIRMED,
        revision: { increment: 1 },
        confirmedById: user.id,
        confirmedAt: new Date(),
      },
    });
    if (!count) throw new ConflictException(CONFLICT);
    await this.audit.log(
      user.id,
      'CALENDAR_CONFIRM',
      'deadlines',
      String(year),
      {
        year,
      },
    );
    const changedDues = await this.engine.recalculate(
      user.id,
      `Xác nhận lịch làm việc năm ${year}`,
    );
    return { ...(await this.get(year)), changedDues };
  }
}

function assertYear(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    throw new BadRequestException('Năm không hợp lệ');
}

function validateDays(year: number, dto: SaveCalendarDaysDto) {
  const seen = new Set<string>();
  return dto.days.map((d) => {
    const date = toBusinessDate(d.date);
    if (date.getUTCFullYear() !== year)
      throw new BadRequestException(`Ngày ${d.date} không thuộc năm ${year}`);
    if (seen.has(d.date))
      throw new BadRequestException(`Ngày ${d.date} bị nhập trùng`);
    seen.add(d.date);
    const weekend = [0, 6].includes(date.getUTCDay());
    if (d.kind === CalendarDayKind.WORKDAY && !weekend)
      throw new BadRequestException(
        `Ngày làm bù ${d.date} phải là thứ 7 hoặc Chủ nhật`,
      );
    return { date, kind: d.kind, name: d.name };
  });
}
