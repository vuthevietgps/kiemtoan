import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateSavedFilterDto,
  SavedFilterExportQueryDto,
  SavedFilterQueryDto,
  SaveScheduleDto,
  UpdateSavedFilterDto,
} from './dto/saved-filter.dto';
import { ReportExporterService, ReportKey } from './report-exporter.service';

const WITH_SCHEDULE = {
  schedule: {
    select: {
      frequency: true,
      enabled: true,
      lastSentAt: true,
      lastResult: true,
      stoppedReason: true,
    },
  },
} satisfies Prisma.ReportSavedFilterInclude;

/**
 * Bộ lọc đã lưu (M11) và hẹn gửi (M12) của chính người dùng: người khác không thấy (404). Tạo / đặt lịch /
 * tải file đều kiểm quyền báo cáo tại thời điểm gọi; danh sách ẩn bộ lọc của báo cáo đã mất quyền.
 */
@Injectable()
export class SavedFiltersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exporter: ReportExporterService,
  ) {}

  async list(query: SavedFilterQueryDto, user: AuthUser) {
    const rows = await this.prisma.reportSavedFilter.findMany({
      where: { userId: user.id, report: query.report },
      include: WITH_SCHEDULE,
      orderBy: [{ report: 'asc' }, { name: 'asc' }],
    });
    return rows.filter((r) =>
      this.exporter.canView(user, r.report as ReportKey),
    );
  }

  async get(id: string, user: AuthUser) {
    const row = await this.own(id, user);
    this.checkView(user, row.report as ReportKey);
    return row;
  }

  async create(dto: CreateSavedFilterDto, user: AuthUser) {
    this.checkView(user, dto.report);
    const params = await this.exporter.cleanParams(dto.report, dto.params);
    return this.unique(() =>
      this.prisma.reportSavedFilter.create({
        data: { userId: user.id, report: dto.report, name: dto.name, params },
        include: WITH_SCHEDULE,
      }),
    );
  }

  async update(id: string, dto: UpdateSavedFilterDto, user: AuthUser) {
    const row = await this.get(id, user);
    const params = dto.params
      ? await this.exporter.cleanParams(row.report as ReportKey, dto.params)
      : undefined;
    return this.unique(() =>
      this.prisma.reportSavedFilter.update({
        where: { id },
        data: { name: dto.name, params },
        include: WITH_SCHEDULE,
      }),
    );
  }

  async remove(id: string, user: AuthUser) {
    await this.own(id, user);
    await this.prisma.reportSavedFilter.delete({ where: { id } });
    return { id };
  }

  /** Bật lại / bật mới: lịch tính từ lúc này, không gửi bù mốc đã qua, xoá lý do tự dừng. */
  async saveSchedule(id: string, dto: SaveScheduleDto, user: AuthUser) {
    const row = await this.own(id, user);
    this.checkExport(user, row.report as ReportKey);
    const switchedOn = dto.enabled && !row.schedule?.enabled;
    const change = {
      frequency: dto.frequency,
      enabled: dto.enabled,
      ...(switchedOn && { activeFrom: new Date(), stoppedReason: null }),
    };
    await this.prisma.reportSchedule.upsert({
      where: { savedFilterId: id },
      create: { ...change, userId: user.id, savedFilterId: id },
      update: change,
    });
    return this.own(id, user);
  }

  async removeSchedule(id: string, user: AuthUser) {
    await this.own(id, user);
    await this.prisma.reportSchedule.deleteMany({
      where: { savedFilterId: id },
    });
    return this.own(id, user);
  }

  /** Excel theo bộ lọc đã lưu; link trong thông báo định kỳ truyền kỳ của lượt gửi. */
  async export(id: string, query: SavedFilterExportQueryDto, user: AuthUser) {
    const row = await this.own(id, user);
    const report = row.report as ReportKey;
    this.checkExport(user, report);
    const params = {
      ...(row.params as Record<string, string>),
      ...(query.from && { from: query.from }),
      ...(query.to && { to: query.to }),
    };
    return this.exporter.build(report, params, user);
  }

  private async own(id: string, user: AuthUser) {
    const row = await this.prisma.reportSavedFilter.findFirst({
      where: { id, userId: user.id },
      include: WITH_SCHEDULE,
    });
    if (!row) throw new NotFoundException('Không tìm thấy bộ lọc');
    return row;
  }

  private checkView(user: AuthUser, report: ReportKey) {
    if (!this.exporter.canView(user, report))
      throw new ForbiddenException('Bạn không có quyền xem báo cáo này');
  }

  private checkExport(user: AuthUser, report: ReportKey) {
    if (!this.exporter.canExport(user, report))
      throw new ForbiddenException('Bạn không có quyền xuất báo cáo này');
  }

  private async unique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      )
        throw new ConflictException('Đã có bộ lọc cùng tên ở báo cáo này');
      throw err;
    }
  }
}
