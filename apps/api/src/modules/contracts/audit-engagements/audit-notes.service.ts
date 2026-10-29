import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus, Prisma, TaskPriority } from '@prisma/client';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import {
  AuditEngagementsQuery,
  canEditEngagement,
  canNoteEngagement,
} from './audit-engagements.query';

type Tx = Prisma.TransactionClient;

/**
 * Mức độ và báo cáo tình hình cụ thể của hồ sơ kiểm toán (04-F4, bám bảng LTGroup). Không đụng
 * `revision` của nhóm/giai đoạn; hồ sơ chưa lưu lần nào được tạo ở lần đầu ghi.
 */
@Injectable()
export class AuditNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: AuditEngagementsQuery,
  ) {}

  async setPriority(
    user: AuthUser,
    contractId: string,
    lineId: string,
    priority: TaskPriority,
  ) {
    const engagement = await this.loadLine(user, contractId, lineId);
    if (!canEditEngagement(user, engagement))
      throw new ForbiddenException(
        'Chỉ Giám đốc, Kế toán trưởng hoặc trưởng nhóm của hồ sơ được đổi mức độ',
      );
    const before = engagement?.priority ?? TaskPriority.NORMAL;
    if (before !== priority)
      await this.prisma.$transaction(async (tx) => {
        const id = await this.ensure(tx, lineId);
        await tx.auditEngagement.update({ where: { id }, data: { priority } });
        await this.log(tx, user, contractId, 'ENGAGEMENT_PRIORITY', {
          lineId,
          from: before,
          to: priority,
        });
      });
    return this.query.get(user, contractId);
  }

  async addNote(
    user: AuthUser,
    contractId: string,
    lineId: string,
    content: string,
  ) {
    const engagement = await this.loadLine(user, contractId, lineId);
    if (!canNoteEngagement(user, engagement))
      throw new ForbiddenException(
        'Chỉ người phụ trách hoặc thành viên nhóm kiểm toán được cập nhật tình hình',
      );
    await this.prisma.$transaction(async (tx) => {
      const id = await this.ensure(tx, lineId);
      await tx.auditEngagementNote.create({
        data: { engagementId: id, content: content.trim(), authorId: user.id },
      });
      await this.log(tx, user, contractId, 'ENGAGEMENT_NOTE', { lineId });
    });
    return this.query.get(user, contractId);
  }

  /** Dòng kiểm toán của HĐ trong phạm vi, HĐ chưa huỷ; trả hồ sơ (null nếu chưa lưu lần nào). */
  private async loadLine(user: AuthUser, contractId: string, lineId: string) {
    const contract = await this.query.load(user, contractId);
    const line = contract.services.find((s) => s.id === lineId);
    if (!line) {
      const exists = await this.prisma.contractService.count({
        where: { id: lineId, contractId },
      });
      if (exists)
        throw new BadRequestException(
          'Dịch vụ này không phát hành báo cáo kiểm toán',
        );
      throw new NotFoundException('Không tìm thấy dòng dịch vụ của hợp đồng');
    }
    if (contract.status === ContractStatus.CANCELLED)
      throw new BadRequestException('Hợp đồng đã huỷ, chỉ xem được');
    return line.audit;
  }

  /** Tạo hồ sơ khi chưa có; hai người tạo cùng lúc thì upsert trả cùng một bản ghi. */
  private async ensure(tx: Tx, lineId: string): Promise<string> {
    const engagement = await tx.auditEngagement.upsert({
      where: { contractServiceId: lineId },
      create: { contractServiceId: lineId },
      update: {},
      select: { id: true },
    });
    return engagement.id;
  }

  private log(
    tx: Tx,
    user: AuthUser,
    contractId: string,
    action: string,
    detail: Prisma.InputJsonObject,
  ) {
    return tx.auditLog.create({
      data: {
        userId: user.id,
        action,
        entity: 'contracts',
        entityId: contractId,
        detail,
      },
    });
  }
}
