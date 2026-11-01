import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  DeliveryChannel,
  DeliveryStatus,
  NotificationKind,
  NotificationSeverity,
  Prisma,
  ReportScheduleFrequency,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { toAuthUser } from '../../core/auth/auth-user.mapper';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationMailer } from '../notifications/notification-mailer';
import { fmtDate, retryAt } from '../notifications/reminder.rules';
import { ReportExporterService, ReportKey } from './report-exporter.service';
import {
  scheduleDue,
  schedulePeriod,
  sendMoment,
} from './utils/report-schedule.rules';
import { toBusinessDate } from './utils/period.util';

const LEASE = 'report-schedules';
const LEASE_MS = 10 * 60_000;
const STUCK_MS = 10 * 60_000;
const SUBJECT = 'REPORT';

const SCHEDULE_INCLUDE = {
  savedFilter: true,
  user: {
    include: {
      accessRole: true,
      notificationPreference: { select: { emailEnabled: true } },
    },
  },
} satisfies Prisma.ReportScheduleInclude;
type Schedule = Prisma.ReportScheduleGetPayload<{
  include: typeof SCHEDULE_INCLUDE;
}>;
type Delivery = Prisma.NotificationDeliveryGetPayload<object>;

export interface ReportRunResult {
  skipped: boolean;
  sent: number;
  notEmailed: number;
  retry: number;
  failed: number;
  stopped: number;
}
type Outcome = Exclude<keyof ReportRunResult, 'skipped'>;

const isUsable = (s: Schedule) =>
  s.user.isActive && !s.user.deletedAt && !s.user.leftAt;

/**
 * Gửi báo cáo định kỳ cho chính chủ (đặc tả 10-F, M12). Chạy mỗi 15 phút, khoá thuê trong DB để chỉ một
 * tiến trình chạy; mỗi lượt là một dòng `notification_deliveries` khoá theo (lịch, tần suất, ngày gửi) nên
 * chạy lại / khởi động lại không gửi trùng. Quyền và phạm vi dữ liệu tính tại lúc gửi; mất quyền thì dừng
 * lịch. Chưa có SMTP / đã tắt email → thông báo trong ứng dụng kèm link tải, ghi rõ "chưa gửi email".
 */
@Injectable()
export class ReportScheduleService {
  private readonly logger = new Logger(ReportScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: NotificationMailer,
    private readonly exporter: ReportExporterService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /** Cùng công tắc với nhắc việc 06: tắt khi test (gọi `runOnce` với đồng hồ giả lập). */
  private enabled(): boolean {
    const fallback = process.env.NODE_ENV === 'test' ? 'false' : 'true';
    return this.config.get<string>('REMINDERS_ENABLED', fallback) === 'true';
  }

  @Cron('*/15 * * * *')
  async tick(): Promise<void> {
    if (!this.enabled()) return;
    try {
      await this.runOnce();
    } catch (err) {
      this.logger.error('Lỗi khi gửi báo cáo định kỳ', err);
    }
  }

  async runOnce(now: Date = new Date()): Promise<ReportRunResult> {
    const result: ReportRunResult = {
      skipped: false,
      sent: 0,
      notEmailed: 0,
      retry: 0,
      failed: 0,
      stopped: 0,
    };
    const token = randomUUID();
    if (!(await this.acquire(token, now))) return { ...result, skipped: true };
    try {
      await this.queueDue(now);
      for (const d of await this.dueDeliveries(now)) {
        const attempts = d.attempts + 1;
        const { count } = await this.prisma.notificationDelivery.updateMany({
          where: { id: d.id, status: d.status, attempts: d.attempts },
          data: { status: DeliveryStatus.SENDING, attempts },
        });
        if (count) result[await this.process(d, now, attempts)]++;
      }
      return result;
    } finally {
      await this.prisma.schedulerLease.deleteMany({
        where: { name: LEASE, owner: token },
      });
    }
  }

  private async acquire(token: string, now: Date): Promise<boolean> {
    const until = new Date(now.getTime() + LEASE_MS);
    const rows = await this.prisma.$executeRaw`
      INSERT INTO scheduler_leases (name, owner, locked_until)
      VALUES (${LEASE}, ${token}, ${until})
      ON CONFLICT (name) DO UPDATE
        SET owner = EXCLUDED.owner, locked_until = EXCLUDED.locked_until
        WHERE scheduler_leases.locked_until < ${now}`;
    return rows === 1;
  }

  /** Tạo dòng chờ gửi cho lịch đến lượt; khoá duy nhất bỏ qua lượt đã có. */
  private async queueDue(now: Date): Promise<void> {
    const schedules = await this.prisma.reportSchedule.findMany({
      where: { enabled: true },
      include: { savedFilter: { select: { name: true } } },
    });
    const rows: Prisma.NotificationDeliveryCreateManyInput[] = [];
    for (const s of schedules) {
      const key = scheduleDue(s.frequency, s.activeFrom, now);
      if (!key) continue;
      rows.push({
        subjectType: SUBJECT,
        subjectId: s.id,
        milestone: s.frequency,
        dueKey: key,
        channel: DeliveryChannel.EMAIL,
        userId: s.userId,
        kind: NotificationKind.GENERAL,
        title: this.title(s.savedFilter.name, s.frequency, key),
        nextAttemptAt: sendMoment(key),
      });
    }
    if (rows.length)
      await this.prisma.notificationDelivery.createMany({
        data: rows,
        skipDuplicates: true,
      });
  }

  private dueDeliveries(now: Date) {
    return this.prisma.notificationDelivery.findMany({
      where: {
        subjectType: SUBJECT,
        channel: DeliveryChannel.EMAIL,
        OR: [
          { status: DeliveryStatus.PENDING, nextAttemptAt: { lte: now } },
          {
            status: DeliveryStatus.SENDING,
            updatedAt: { lt: new Date(now.getTime() - STUCK_MS) },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  /** Xử lý một lượt (mới hoặc thử lại): luôn đọc lại lịch, người dùng và quyền ngay lúc này. */
  private async process(
    d: Delivery,
    now: Date,
    attempts: number,
  ): Promise<Outcome> {
    const schedule = await this.prisma.reportSchedule.findUnique({
      where: { id: d.subjectId },
      include: SCHEDULE_INCLUDE,
    });
    if (!schedule?.enabled) {
      await this.finish(d, DeliveryStatus.CANCELLED, {
        lastError: 'Lịch gửi đã tắt hoặc đã xoá',
      });
      return 'stopped';
    }
    const report = schedule.savedFilter.report as ReportKey;
    const user = toAuthUser(schedule.user);
    if (!isUsable(schedule) || !this.exporter.canExport(user, report)) {
      await this.stop(d, schedule, now);
      return 'stopped';
    }
    const period = schedulePeriod(schedule.frequency, d.dueKey);
    const link = `/reports?savedFilter=${schedule.savedFilterId}&from=${period.from}&to=${period.to}`;
    const reason = this.noEmailReason(schedule);
    if (reason) {
      await this.notEmailed(d, schedule, link, reason, now);
      return 'notEmailed';
    }
    try {
      await this.sendReport(d, schedule, user, period, link);
      await this.finish(d, DeliveryStatus.SENT, {
        sentAt: now,
        lastError: null,
        link,
      });
      await this.remember(schedule.id, 'SENT', now);
      return 'sent';
    } catch (err) {
      return this.failed(d, schedule, link, err, now, attempts);
    }
  }

  private noEmailReason(s: Schedule): string | null {
    if (!this.mailer.isConfigured()) return 'chưa cấu hình SMTP';
    if (s.user.notificationPreference?.emailEnabled === false)
      return 'bạn đã tắt nhận email';
    return s.user.email ? null : 'tài khoản không có email';
  }

  private async sendReport(
    d: Delivery,
    s: Schedule,
    user: AuthUser,
    period: { from: string; to: string },
    link: string,
  ): Promise<void> {
    const report = s.savedFilter.report as ReportKey;
    const params = {
      ...(s.savedFilter.params as Record<string, string>),
      ...period,
    };
    const file = await this.exporter.build(report, params, user);
    await this.mailer.send(
      s.user.email,
      d.title,
      `${d.title}\n\nFile Excel đính kèm, số liệu theo quyền của bạn tại lúc gửi.\n\nMở trên phần mềm: ${this.mailer.appOrigin()}${link}`,
      [{ filename: file.fileName, content: file.buffer }],
    );
    await this.audit.log(s.userId, 'EXPORT', 'reports', s.savedFilterId, {
      via: 'schedule',
      report,
      ...period,
    });
  }

  /** Không gửi được email: ghi rõ lý do, báo trong ứng dụng kèm link tải (M12). */
  private async notEmailed(
    d: Delivery,
    s: Schedule,
    link: string,
    reason: string,
    now: Date,
  ) {
    await this.finish(d, DeliveryStatus.SKIPPED, {
      lastError: `Không gửi — ${reason}`,
      link,
    });
    await this.notify(s.userId, d, {
      title: `${d.title} — chưa gửi email (${reason}), bấm để tải`,
      link,
      severity: NotificationSeverity.WARNING,
    });
    await this.remember(s.id, 'NOT_EMAILED', now);
  }

  /** Lỗi gửi: thử lại theo I12; hết lượt thì báo trong ứng dụng kèm link tải. */
  private async failed(
    d: Delivery,
    s: Schedule,
    link: string,
    err: unknown,
    now: Date,
    attempts: number,
  ): Promise<Outcome> {
    const next = retryAt(now, attempts);
    const lastError = (err instanceof Error ? err.message : String(err)).slice(
      0,
      500,
    );
    await this.finish(
      d,
      next ? DeliveryStatus.PENDING : DeliveryStatus.FAILED,
      {
        nextAttemptAt: next,
        lastError,
        link,
      },
    );
    if (next) return 'retry';
    await this.notify(s.userId, d, {
      title: `${d.title} — gửi email thất bại, bấm để tải`,
      link,
      severity: NotificationSeverity.DANGER,
    });
    await this.remember(s.id, 'FAILED', now);
    return 'failed';
  }

  /** Mất quyền / tài khoản ngừng: dừng lịch, không tạo file, báo chủ lịch nếu còn hoạt động. */
  private async stop(d: Delivery, s: Schedule, now: Date) {
    const reason = isUsable(s)
      ? 'Bạn không còn quyền xuất báo cáo này'
      : 'Tài khoản đã ngừng hoạt động';
    await this.finish(d, DeliveryStatus.CANCELLED, { lastError: reason });
    await this.prisma.reportSchedule.update({
      where: { id: s.id },
      data: {
        enabled: false,
        stoppedReason: reason,
        lastResult: 'STOPPED',
      },
    });
    await this.audit.log(s.userId, 'UPDATE', 'report-schedules', s.id, {
      stopped: reason,
      at: now.toISOString(),
    });
    if (isUsable(s))
      await this.notify(s.userId, d, {
        title: `Đã dừng gửi báo cáo "${s.savedFilter.name}": ${reason.toLowerCase()}`,
        link: null,
        severity: NotificationSeverity.WARNING,
      });
  }

  private finish(
    d: Delivery,
    status: DeliveryStatus,
    data: Prisma.NotificationDeliveryUpdateInput,
  ) {
    return this.prisma.notificationDelivery.update({
      where: { id: d.id },
      data: { ...data, status },
    });
  }

  private notify(
    userId: string,
    d: Delivery,
    n: { title: string; link: string | null; severity: NotificationSeverity },
  ) {
    return this.prisma.notification.create({
      data: {
        ...n,
        userId,
        kind: NotificationKind.GENERAL,
        subjectType: SUBJECT,
        subjectId: d.subjectId,
      },
    });
  }

  private remember(id: string, lastResult: string, now: Date) {
    return this.prisma.reportSchedule.update({
      where: { id },
      data: { lastResult, ...(lastResult === 'SENT' && { lastSentAt: now }) },
    });
  }

  private title(
    name: string,
    frequency: ReportScheduleFrequency,
    key: Date,
  ): string {
    const { from, to } = schedulePeriod(frequency, key);
    const vn = (d: string) => fmtDate(toBusinessDate(d));
    return `Báo cáo định kỳ "${name}": ${vn(from)} – ${vn(to)}`;
  }
}
