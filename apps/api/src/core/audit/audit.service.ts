import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Ghi nhật ký hoạt động. Nhật ký chỉ thêm mới, không ai sửa hay xoá được. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    userId: string | null,
    action: string,
    entity: string,
    entityId?: string | null,
    detail?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { userId, action, entity, entityId: entityId ?? null, detail },
    });
  }
}
