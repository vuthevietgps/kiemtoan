import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  ReminderSettingsDto,
  ServiceThresholdsDto,
} from './dto/reminder-settings.dto';
import { DEFAULT_THRESHOLDS, thresholdsError } from './urgency';

/** Cấu hình nhắc việc và ngưỡng mức gấp (đặc tả 06, I9/I11). Quyền `settings:view/update`. */
@Injectable()
export class ReminderSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get() {
    const row = await this.prisma.reminderSetting.findUnique({
      where: { id: 1 },
    });
    return (
      row ?? {
        id: 1,
        thresholds: DEFAULT_THRESHOLDS,
        sendTime: '07:30',
        escalationWorkingDays: 3,
        revision: 1,
        updatedById: null,
        updatedAt: null,
      }
    );
  }

  async update(user: AuthUser, dto: ReminderSettingsDto) {
    const error = thresholdsError(dto.thresholds);
    if (error) throw new BadRequestException(error);
    const before = await this.get();
    const data = {
      thresholds: dto.thresholds,
      sendTime: dto.sendTime,
      escalationWorkingDays: dto.escalationWorkingDays,
      updatedById: user.id,
    };
    // Chưa có dòng cấu hình (DB khôi phục thiếu dữ liệu migration): tạo mới từ mặc định revision 1.
    const count = before.updatedAt
      ? (
          await this.prisma.reminderSetting.updateMany({
            where: { id: 1, revision: dto.revision },
            data: { ...data, revision: { increment: 1 } },
          })
        ).count
      : dto.revision === 1
        ? await this.prisma.reminderSetting
            .create({ data: { id: 1, ...data, revision: 2 } })
            .then(
              () => 1,
              () => 0,
            )
        : 0;
    if (!count)
      throw new ConflictException(
        'Cấu hình vừa được người khác sửa; vui lòng tải lại',
      );
    await this.audit.log(user.id, 'REMINDER_SETTINGS', 'settings', null, {
      before: {
        thresholds: before.thresholds,
        sendTime: before.sendTime,
        escalationWorkingDays: before.escalationWorkingDays,
      },
      after: data,
    });
    return this.get();
  }

  listServiceThresholds() {
    return this.prisma.serviceUrgencyThreshold.findMany({
      include: {
        serviceType: { select: { id: true, code: true, name: true } },
      },
      orderBy: { serviceType: { code: 'asc' } },
    });
  }

  async setServiceThresholds(
    user: AuthUser,
    serviceTypeId: string,
    dto: ServiceThresholdsDto,
  ) {
    const error = thresholdsError(dto.thresholds);
    if (error) throw new BadRequestException(error);
    const service = await this.prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
      select: { id: true },
    });
    if (!service) throw new NotFoundException('Không tìm thấy dịch vụ');
    const row = await this.prisma.serviceUrgencyThreshold.upsert({
      where: { serviceTypeId },
      create: {
        serviceTypeId,
        thresholds: dto.thresholds,
        updatedById: user.id,
      },
      update: { thresholds: dto.thresholds, updatedById: user.id },
    });
    await this.audit.log(
      user.id,
      'SERVICE_URGENCY',
      'settings',
      serviceTypeId,
      {
        thresholds: dto.thresholds,
      },
    );
    return row;
  }

  async removeServiceThresholds(user: AuthUser, serviceTypeId: string) {
    const { count } = await this.prisma.serviceUrgencyThreshold.deleteMany({
      where: { serviceTypeId },
    });
    if (!count) throw new NotFoundException('Dịch vụ chưa có ngưỡng riêng');
    await this.audit.log(
      user.id,
      'SERVICE_URGENCY_REMOVE',
      'settings',
      serviceTypeId,
    );
    return { serviceTypeId };
  }
}
