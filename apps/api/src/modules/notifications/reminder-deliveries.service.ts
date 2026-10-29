import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryChannel, DeliveryStatus, Prisma } from '@prisma/client';
import { paginated, toSkipTake } from '../../common/types/paginated';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { DeliveryQueryDto, PreferencesDto } from './dto/notification.dto';

/** Nhật ký gửi (I12) và tuỳ chọn nhận email/bản tin của từng người (I10). */
@Injectable()
export class ReminderDeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: DeliveryQueryDto) {
    const where: Prisma.NotificationDeliveryWhereInput = {
      status: query.status,
      channel: query.channel,
      ...(query.search && {
        title: { contains: query.search, mode: 'insensitive' },
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationDelivery.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.notificationDelivery.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  /** Gửi lại thủ công email Thất bại/Không gửi (sau khi sửa SMTP hoặc email người nhận). */
  async retry(user: AuthUser, id: string) {
    const found = await this.prisma.notificationDelivery.findUnique({
      where: { id },
    });
    if (!found) throw new NotFoundException('Không tìm thấy lần gửi');
    const retryable: DeliveryStatus[] = [
      DeliveryStatus.FAILED,
      DeliveryStatus.SKIPPED,
    ];
    if (
      found.channel !== DeliveryChannel.EMAIL ||
      !retryable.includes(found.status)
    )
      throw new BadRequestException(
        'Chỉ gửi lại email ở trạng thái Thất bại hoặc Không gửi',
      );
    const updated = await this.prisma.notificationDelivery.update({
      where: { id },
      data: {
        status: DeliveryStatus.PENDING,
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
      },
    });
    await this.audit.log(user.id, 'DELIVERY_RETRY', 'notifications', id);
    return updated;
  }

  async preferences(userId: string) {
    const row = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    return {
      emailEnabled: row?.emailEnabled ?? true,
      digestEnabled: row?.digestEnabled ?? true,
    };
  }

  async setPreferences(userId: string, dto: PreferencesDto) {
    await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
    return this.preferences(userId);
  }
}
