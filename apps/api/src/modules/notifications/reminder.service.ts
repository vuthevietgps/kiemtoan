import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DeliveryChannel, DeliveryStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { loadUrgencyConfig } from '../deadlines/urgency';
import { loadWorkingCalendar } from '../deadlines/working-calendar.loader';
import { todayVn } from '../reports/utils/period.util';
import { planCredentialReminders } from './credential-reminders';
import { NotificationMailer } from './notification-mailer';
import { cancelStaleEmails } from './reminder-cancel';
import {
  planDigest,
  planObligationReminders,
  planReviewSla,
  planTaskReminders,
  type PlanContext,
  type PlannedReminder,
} from './reminder-planner';
import { retryAt, sendTimeReached } from './reminder.rules';

const LEASE = 'reminders';
const LEASE_MS = 10 * 60_000;
const STUCK_MS = 10 * 60_000;

export interface ReminderRunResult {
  skipped: boolean;
  planned: number;
  inApp: number;
  emailsQueued: number;
  cancelled: number;
  emails: Record<'sent' | 'retry' | 'failed' | 'skipped', number>;
}

/**
 * Nhắc việc theo lịch (đặc tả 06-C, I9–I13). Chạy mỗi 15 phút và lúc khởi động; khoá thuê trong DB để
 * chỉ một tiến trình chạy; mỗi lần gửi ghi `notification_deliveries` với khoá duy nhất nên chạy lại,
 * khởi động lại hay chạy song song đều không gửi trùng. Email lỗi thử lại theo I12.
 */
@Injectable()
export class ReminderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: NotificationMailer,
    private readonly config: ConfigService,
  ) {}

  /** Tắt khi chạy test (gọi `runOnce` trực tiếp với đồng hồ giả lập) hoặc `REMINDERS_ENABLED=false`. */
  private enabled(): boolean {
    const fallback = process.env.NODE_ENV === 'test' ? 'false' : 'true';
    return this.config.get<string>('REMINDERS_ENABLED', fallback) === 'true';
  }

  onApplicationBootstrap(): void {
    if (this.enabled()) setTimeout(() => void this.tick(), 5_000).unref();
  }

  @Cron('*/15 * * * *')
  async tick(): Promise<void> {
    if (!this.enabled()) return;
    try {
      await this.runOnce();
    } catch (err) {
      this.logger.error('Lỗi khi chạy nhắc việc', err);
    }
  }

  async runOnce(now: Date = new Date()): Promise<ReminderRunResult> {
    const token = randomUUID();
    const result: ReminderRunResult = {
      skipped: false,
      planned: 0,
      inApp: 0,
      emailsQueued: 0,
      cancelled: 0,
      emails: { sent: 0, retry: 0, failed: 0, skipped: 0 },
    };
    if (!(await this.acquire(token, now))) return { ...result, skipped: true };
    try {
      const planned = await this.plan(now);
      result.planned = planned.length;
      for (const item of planned) {
        const r = await this.record(item, now);
        result.inApp += r.inApp;
        result.emailsQueued += r.email;
      }
      result.cancelled = await cancelStaleEmails(this.prisma);
      result.emails = await this.sendEmails(now);
      return result;
    } finally {
      await this.prisma.schedulerLease.deleteMany({
        where: { name: LEASE, owner: token },
      });
    }
  }

  /** Khoá thuê: nhận khi chưa có hoặc đã hết hạn (tiến trình trước dừng giữa chừng). */
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

  private async plan(now: Date): Promise<PlannedReminder[]> {
    const setting = await this.prisma.reminderSetting.findUnique({
      where: { id: 1 },
    });
    if (!sendTimeReached(now, setting?.sendTime ?? '07:30')) return [];
    const ctx: PlanContext = {
      now,
      today: todayVn(now),
      calendar: await loadWorkingCalendar(this.prisma),
      urgency: await loadUrgencyConfig(this.prisma),
      escalationWorkingDays: setting?.escalationWorkingDays ?? 3,
    };
    const planned = [
      ...(await planTaskReminders(this.prisma, ctx)),
      ...(await planObligationReminders(this.prisma, ctx)),
      ...(await planReviewSla(this.prisma, ctx)),
      // 09-C (L9): hạn token / tài khoản và token mượn quá hạn trả.
      ...(await planCredentialReminders(this.prisma, ctx)),
    ];
    if (ctx.calendar.isWorkingDay(ctx.today))
      planned.push(...(await this.planDigests(ctx)));
    return planned;
  }

  /** Bản tin sáng ngày làm việc cho người còn hoạt động, chưa tắt bản tin, chưa nhận hôm nay. */
  private async planDigests(ctx: PlanContext): Promise<PlannedReminder[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        leftAt: null,
        notificationPreference: { isNot: { digestEnabled: false } },
        notificationDeliveries: {
          none: {
            subjectType: 'USER',
            milestone: 'DIGEST',
            dueKey: ctx.today,
            channel: DeliveryChannel.IN_APP,
          },
        },
      },
      select: { id: true },
    });
    const result: PlannedReminder[] = [];
    for (const user of users) {
      const digest = await planDigest(this.prisma, ctx, user.id);
      if (digest) result.push(digest);
    }
    return result;
  }

  /**
   * Ghi một mốc cho mọi người nhận trong một transaction: dòng gửi trùng khoá bị bỏ qua; dòng trong
   * ứng dụng mới tạo → tạo thông báo ngay; dòng email chờ gửi.
   */
  private async record(item: PlannedReminder, now: Date) {
    const ids = [...new Set(item.userIds.filter((id): id is string => !!id))];
    if (!ids.length) return { inApp: 0, email: 0 };
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, isActive: true, deletedAt: null, leftAt: null },
      select: {
        id: true,
        email: true,
        notificationPreference: { select: { emailEnabled: true } },
      },
    });
    const base = {
      subjectType: item.subjectType,
      subjectId: item.subjectId,
      milestone: item.milestone,
      dueKey: item.dueKey,
      kind: item.kind,
      severity: item.severity,
      title: item.title,
      body: item.body ?? null,
      link: item.link,
    };
    const rows: Prisma.NotificationDeliveryCreateManyInput[] = users.flatMap(
      (u) => [
        { ...base, userId: u.id, channel: DeliveryChannel.IN_APP },
        ...(item.email && u.notificationPreference?.emailEnabled !== false
          ? [
              {
                ...base,
                userId: u.id,
                channel: DeliveryChannel.EMAIL,
                nextAttemptAt: now,
              },
            ]
          : []),
      ],
    );
    if (!rows.length) return { inApp: 0, email: 0 };
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.notificationDelivery.createManyAndReturn({
        data: rows,
        skipDuplicates: true,
      });
      let inApp = 0;
      for (const d of created) {
        if (d.channel !== DeliveryChannel.IN_APP) continue;
        const n = await tx.notification.create({
          data: {
            userId: d.userId,
            title: d.title,
            link: d.link,
            kind: d.kind,
            severity: d.severity,
            subjectType: d.subjectType,
            subjectId: d.subjectId,
          },
        });
        await tx.notificationDelivery.update({
          where: { id: d.id },
          data: {
            status: DeliveryStatus.SENT,
            sentAt: now,
            notificationId: n.id,
          },
        });
        inApp++;
      }
      return { inApp, email: created.length - inApp };
    });
  }

  /** Gửi email đến lượt; đang gửi quá 10 phút (tiến trình dừng) thì nhận lại. */
  async sendEmails(now: Date): Promise<ReminderRunResult['emails']> {
    const stats = { sent: 0, retry: 0, failed: 0, skipped: 0 };
    const due = await this.prisma.notificationDelivery.findMany({
      where: {
        channel: DeliveryChannel.EMAIL,
        OR: [
          { status: DeliveryStatus.PENDING, nextAttemptAt: { lte: now } },
          {
            status: DeliveryStatus.SENDING,
            updatedAt: { lt: new Date(now.getTime() - STUCK_MS) },
          },
        ],
      },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    for (const d of due) {
      const attempts = d.attempts + 1;
      const { count } = await this.prisma.notificationDelivery.updateMany({
        where: { id: d.id, status: d.status, attempts: d.attempts },
        data: { status: DeliveryStatus.SENDING, attempts },
      });
      if (!count) continue;
      const outcome = await this.deliver(d, now, attempts);
      stats[outcome]++;
    }
    return stats;
  }

  private async deliver(
    d: {
      id: string;
      title: string;
      body: string | null;
      link: string | null;
      user: { email: string };
    },
    now: Date,
    attempts: number,
  ): Promise<'sent' | 'retry' | 'failed' | 'skipped'> {
    const update = (data: Prisma.NotificationDeliveryUpdateInput) =>
      this.prisma.notificationDelivery.update({ where: { id: d.id }, data });
    if (!this.mailer.isConfigured() || !d.user.email) {
      await update({
        status: DeliveryStatus.SKIPPED,
        lastError: this.mailer.isConfigured()
          ? 'Người nhận không có email'
          : 'Không gửi — chưa cấu hình SMTP',
      });
      return 'skipped';
    }
    try {
      const link = d.link
        ? `\n\nMở trên phần mềm: ${this.mailer.appOrigin()}${d.link}`
        : '';
      await this.mailer.send(
        d.user.email,
        d.title,
        `${d.body ?? d.title}${link}`,
      );
      await update({
        status: DeliveryStatus.SENT,
        sentAt: now,
        lastError: null,
      });
      return 'sent';
    } catch (err) {
      const next = retryAt(now, attempts);
      await update({
        status: next ? DeliveryStatus.PENDING : DeliveryStatus.FAILED,
        nextAttemptAt: next,
        lastError: (err instanceof Error ? err.message : String(err)).slice(
          0,
          500,
        ),
      });
      return next ? 'retry' : 'failed';
    }
  }
}
