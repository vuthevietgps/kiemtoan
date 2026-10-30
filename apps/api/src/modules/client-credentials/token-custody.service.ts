import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CredentialEventType, TokenCustody } from '@prisma/client';
import { customerScope } from '../../core/access-control/data-scope';
import { hasPermission } from '../../core/access-control/permissions';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { toAuthUser } from '../../core/auth/auth-user.mapper';
import { PrismaService } from '../../core/prisma/prisma.service';
import { todayVn, toBusinessDate } from '../reports/utils/period.util';
import { ClientCredentialsQueryService } from './client-credentials-query.service';
import { CredentialStore, StoredCredential } from './credential-store';
import { custodyEvent, isToken, loanDueError } from './credential.rules';
import {
  BorrowTokenDto,
  HandOverTokenDto,
  ReturnTokenDto,
  TokenCustodyDto,
} from './dto/client-credential.dto';

const NO_LOAN = {
  holderId: null,
  loanedAt: null,
  loanDueAt: null,
  loanPurpose: null,
};
const person = (u: AuthUser | { id: string; fullName: string }) => ({
  id: u.id,
  fullName: u.fullName,
});

/**
 * Nơi giữ token chữ ký số (đặc tả 09, L3–L4): nhân viên tự mượn token đang ở văn phòng, người mượn hoặc
 * người có `update` ghi nhận trả; người có `update` giao cho nhân viên khác, nhận từ khách, trả khách,
 * thu hồi, đổi nơi cất. Mỗi lệnh kiểm `revision` (mượn cùng lúc → một 200, một 409) và ghi sự kiện.
 */
@Injectable()
export class TokenCustodyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: CredentialStore,
    private readonly query: ClientCredentialsQueryService,
  ) {}

  async borrow(user: AuthUser, id: string, dto: BorrowTokenDto) {
    const found = await this.loadToken(user, id, dto.revision);
    if (found.custody !== TokenCustody.OFFICE)
      throw new BadRequestException(
        found.custody === TokenCustody.LOANED
          ? 'Token đang được người khác mượn'
          : 'Chỉ mượn được token đang cất tại văn phòng',
      );
    const due = this.dueDate(dto.dueDate);
    await this.store.commit(user, found, this.loan(user.id, due, dto.purpose), [
      {
        type: CredentialEventType.BORROWED,
        note: dto.purpose,
        detail: { holder: person(user), dueDate: dto.dueDate.slice(0, 10) },
      },
    ]);
    return this.query.findOne(user, id);
  }

  async returnToken(user: AuthUser, id: string, dto: ReturnTokenDto) {
    const found = await this.loadToken(user, id, dto.revision);
    if (found.custody !== TokenCustody.LOANED)
      throw new BadRequestException('Token không ở trạng thái đang mượn');
    if (
      found.holderId !== user.id &&
      !hasPermission(user, 'client-credentials', 'update')
    )
      throw new ForbiddenException(
        'Chỉ người đang mượn hoặc quản lý kho được ghi nhận trả',
      );
    await this.store.commit(
      user,
      found,
      {
        ...NO_LOAN,
        custody: TokenCustody.OFFICE,
        storageLocation: dto.storageLocation ?? found.storageLocation,
      },
      [
        {
          type: CredentialEventType.RETURNED,
          note: dto.note,
          detail: { holderId: found.holderId },
        },
      ],
    );
    return this.query.findOne(user, id);
  }

  /** Giao token (đang ở văn phòng hoặc đang mượn) cho một nhân viên được xem KH này. */
  async handOver(user: AuthUser, id: string, dto: HandOverTokenDto) {
    const found = await this.loadToken(user, id, dto.revision);
    if (
      found.custody !== TokenCustody.OFFICE &&
      found.custody !== TokenCustody.LOANED
    )
      throw new BadRequestException(
        'Cần nhận token về văn phòng trước khi giao',
      );
    if (found.holderId === dto.holderId)
      throw new BadRequestException('Người này đang giữ token');
    const due = this.dueDate(dto.dueDate);
    const holder = await this.eligibleHolder(dto.holderId, found.customerId);
    await this.store.commit(
      user,
      found,
      this.loan(holder.id, due, dto.purpose),
      [
        {
          type: CredentialEventType.HANDED_OVER,
          note: dto.purpose,
          detail: {
            fromHolderId: found.holderId,
            holder: person(holder),
            dueDate: dto.dueDate.slice(0, 10),
          },
        },
      ],
    );
    return this.query.findOne(user, id);
  }

  /** Nhận từ khách / trả khách / thu hồi về văn phòng / đổi vị trí cất. */
  async setCustody(user: AuthUser, id: string, dto: TokenCustodyDto) {
    const found = await this.loadToken(user, id, dto.revision);
    const change = custodyEvent(found.custody, dto.custody);
    if ('error' in change) throw new BadRequestException(change.error);
    const office = dto.custody === TokenCustody.OFFICE;
    await this.store.commit(
      user,
      found,
      {
        ...NO_LOAN,
        custody: dto.custody,
        storageLocation: office
          ? (dto.storageLocation ?? found.storageLocation)
          : null,
      },
      [
        {
          type: change.event,
          note: dto.note,
          detail: {
            from: found.custody,
            to: dto.custody,
            ...(found.holderId && { holderId: found.holderId }),
          },
        },
      ],
    );
    return this.query.findOne(user, id);
  }

  private async loadToken(
    user: AuthUser,
    id: string,
    revision: number,
  ): Promise<StoredCredential> {
    const found = await this.store.loadForWrite(user, id, revision);
    if (!isToken(found.type))
      throw new BadRequestException('Chỉ áp dụng cho token chữ ký số');
    return found;
  }

  private loan(holderId: string, due: Date, purpose?: string | null) {
    return {
      custody: TokenCustody.LOANED,
      holderId,
      loanedAt: new Date(),
      loanDueAt: due,
      loanPurpose: purpose ?? null,
    };
  }

  private dueDate(value: string): Date {
    const due = toBusinessDate(value);
    const error = loanDueError(due, todayVn());
    if (error) throw new BadRequestException(error);
    return due;
  }

  /** Người nhận: đang hoạt động, có quyền xem kho và KH nằm trong phạm vi của họ. */
  private async eligibleHolder(holderId: string, customerId: string) {
    const row = await this.prisma.user.findFirst({
      where: { id: holderId, isActive: true, deletedAt: null },
      include: { accessRole: true },
    });
    const holder = row ? toAuthUser(row) : null;
    const visible =
      holder &&
      hasPermission(holder, 'client-credentials', 'view') &&
      (await this.prisma.customer.count({
        where: { AND: [{ id: customerId }, customerScope(holder)] },
      }));
    if (!holder || !visible)
      throw new BadRequestException(
        'Người nhận không được xem khách hàng này hoặc không còn hoạt động',
      );
    return holder;
  }
}
