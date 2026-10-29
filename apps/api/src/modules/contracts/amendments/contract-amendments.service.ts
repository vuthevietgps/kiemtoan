import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AmendmentLineAction, AmendmentStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../../../core/auth/auth-user.interface';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { scopedContract } from '../contracts-query.service';
import { SaveAmendmentDto } from '../dto/contract-amendment.dto';
import {
  AMENDABLE,
  amendmentLabel,
  ContractState,
  fingerprintOf,
  loadContractState,
  prepareAmendment,
  snapshotOf,
  StoredScheduleItem,
} from './amendment-state';
import { applyLines, applySchedule } from './amendment-apply';

const { DRAFT, PENDING_APPROVAL, APPROVED, CANCELLED } = AmendmentStatus;
type Tx = Prisma.TransactionClient;

const WITH_LINES = {
  lines: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ContractAmendmentInclude;

/**
 * Phụ lục HĐ (đặc tả 04-D, E6): Nháp → Chờ duyệt → Đã duyệt. Khi giám đốc duyệt, thay đổi dòng
 * dịch vụ, tổng tiền và đợt thanh toán được áp vào HĐ trong một transaction và lưu ảnh trước–sau.
 */
@Injectable()
export class ContractAmendmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, contractId: string) {
    await this.findContract(user, contractId);
    const amendments = await this.prisma.contractAmendment.findMany({
      where: { contractId },
      include: WITH_LINES,
      orderBy: { number: 'desc' },
    });
    const typeIds = amendments.flatMap((a) =>
      a.lines.map((l) => l.serviceTypeId).filter((v): v is string => !!v),
    );
    const types = await this.prisma.serviceType.findMany({
      where: { id: { in: [...new Set(typeIds)] } },
      select: { id: true, code: true, name: true },
    });
    return amendments.map((a) => ({
      ...a,
      code: amendmentLabel(a.number),
      lines: a.lines.map((l) => ({
        ...l,
        serviceType: types.find((t) => t.id === l.serviceTypeId) ?? null,
      })),
    }));
  }

  async create(user: AuthUser, contractId: string, dto: SaveAmendmentDto) {
    await this.findContract(user, contractId);
    return this.prisma.$transaction(async (tx) => {
      const state = await this.lockState(tx, contractId);
      const last = await tx.contractAmendment.aggregate({
        where: { contractId },
        _max: { number: true },
      });
      const number = (last._max.number ?? 0) + 1;
      const data = await this.buildData(tx, state, number, dto);
      const amendment = await tx.contractAmendment.create({
        data: { ...data, contractId, number, createdById: user.id },
      });
      await this.audit(tx, user, contractId, 'AMENDMENT_CREATE', amendment);
      return amendment;
    });
  }

  async update(
    user: AuthUser,
    contractId: string,
    id: string,
    dto: SaveAmendmentDto,
  ) {
    await this.findContract(user, contractId);
    return this.prisma.$transaction(async (tx) => {
      const state = await this.lockState(tx, contractId);
      const current = await this.findAmendment(tx, contractId, id);
      if (current.status !== DRAFT)
        throw new BadRequestException('Chỉ sửa được phụ lục nháp');
      const { lines, ...data } = await this.buildData(
        tx,
        state,
        current.number,
        dto,
      );
      await tx.contractAmendmentLine.deleteMany({ where: { amendmentId: id } });
      return tx.contractAmendment.update({
        where: { id },
        data: { ...data, returnedReason: null, lines },
      });
    });
  }

  /** Gửi duyệt: tính lại trên HĐ hiện tại để chặn phụ lục đã cũ. */
  async submit(user: AuthUser, contractId: string, id: string) {
    await this.findContract(user, contractId);
    return this.prisma.$transaction(async (tx) => {
      const state = await this.lockState(tx, contractId);
      const amendment = await this.findAmendment(tx, contractId, id);
      if (amendment.status !== DRAFT)
        throw new BadRequestException('Chỉ gửi duyệt được phụ lục nháp');
      await this.recompute(tx, state, amendment);
      return this.transition(tx, user, amendment, DRAFT, PENDING_APPROVAL, {
        submittedAt: new Date(),
      });
    });
  }

  async returnToDraft(
    user: AuthUser,
    contractId: string,
    id: string,
    reason: string,
  ) {
    await this.findContract(user, contractId);
    return this.prisma.$transaction(async (tx) => {
      const amendment = await this.findAmendment(tx, contractId, id);
      if (amendment.status !== PENDING_APPROVAL)
        throw new BadRequestException('Chỉ trả lại được phụ lục chờ duyệt');
      return this.transition(tx, user, amendment, PENDING_APPROVAL, DRAFT, {
        returnedReason: reason,
      });
    });
  }

  async cancel(user: AuthUser, contractId: string, id: string) {
    await this.findContract(user, contractId);
    return this.prisma.$transaction(async (tx) => {
      const amendment = await this.findAmendment(tx, contractId, id);
      if (amendment.status !== DRAFT && amendment.status !== PENDING_APPROVAL)
        throw new BadRequestException('Phụ lục đã duyệt hoặc đã huỷ');
      return this.transition(
        tx,
        user,
        amendment,
        amendment.status,
        CANCELLED,
        {},
      );
    });
  }

  /** Duyệt: khoá HĐ, tính lại, áp dòng dịch vụ/đợt/tổng tiền, lưu trước–sau. Bấm đồng thời → 409. */
  async approve(user: AuthUser, contractId: string, id: string) {
    await this.findContract(user, contractId);
    return this.prisma.$transaction(async (tx) => {
      const state = await this.lockState(tx, contractId);
      const amendment = await this.findAmendment(tx, contractId, id);
      if (amendment.status === APPROVED)
        throw new ConflictException('Phụ lục đã được duyệt');
      if (amendment.status !== PENDING_APPROVAL)
        throw new BadRequestException('Phụ lục không ở trạng thái chờ duyệt');
      const { result, schedule } = await this.recompute(tx, state, amendment);
      const before = snapshotOf(
        state.lines,
        state.installments,
        state.contract,
      );
      await applyLines(tx, state, result.lines, result.removed);
      await applySchedule(tx, state, schedule);
      await tx.contract.update({
        where: { id: contractId },
        data: {
          subtotal: result.subtotal,
          vatAmount: result.vatAmount,
          total: result.total,
        },
      });
      const after = snapshotOf(result.lines, schedule, result);
      return this.transition(tx, user, amendment, PENDING_APPROVAL, APPROVED, {
        approvedById: user.id,
        approvedAt: new Date(),
        before,
        after,
      });
    });
  }

  private async buildData(
    tx: Tx,
    state: ContractState,
    number: number,
    dto: SaveAmendmentDto,
  ) {
    const effectiveDate = dto.effectiveDate
      ? new Date(dto.effectiveDate)
      : null;
    const { result, schedule } = await prepareAmendment(tx, state, {
      number,
      lines: dto.lines,
      installments: dto.installments,
      effectiveDate,
    });
    const byId = new Map(state.lines.map((l) => [l.id, l]));
    return {
      title: dto.title,
      content: dto.content ?? null,
      baseFingerprint: fingerprintOf(state),
      effectiveDate,
      subtotal: result.subtotal,
      vatAmount: result.vatAmount,
      total: result.total,
      installments: schedule as unknown as Prisma.InputJsonArray,
      lines: {
        create: dto.lines.map((line, index) => {
          const existing = line.contractServiceId
            ? byId.get(line.contractServiceId)
            : undefined;
          const quantity = line.quantity ?? existing?.quantity ?? null;
          const unitPrice = line.unitPrice ?? existing?.unitPrice ?? null;
          return {
            sortOrder: index + 1,
            action: line.action,
            contractServiceId: existing?.id ?? null,
            serviceTypeId: existing?.serviceTypeId ?? line.serviceTypeId,
            description: line.description ?? existing?.description ?? null,
            period: existing?.period ?? line.period ?? null,
            quantity,
            unitPrice,
            amount:
              line.action === AmendmentLineAction.REMOVE ||
              quantity === null ||
              unitPrice === null
                ? null
                : new Prisma.Decimal(unitPrice).mul(quantity),
            assigneeId: line.assigneeId ?? existing?.assigneeId ?? null,
          };
        }),
      },
    };
  }

  /** Tính lại theo HĐ hiện tại; HĐ đã đổi so với lúc lập phụ lục thì yêu cầu cập nhật lại (409). */
  private async recompute(
    tx: Tx,
    state: ContractState,
    amendment: Prisma.ContractAmendmentGetPayload<{
      include: typeof WITH_LINES;
    }>,
  ) {
    const stale = () =>
      new ConflictException(
        'Hợp đồng đã thay đổi sau khi lập phụ lục; hãy cập nhật lại phụ lục (trả lại nếu đang chờ duyệt)',
      );
    if (fingerprintOf(state) !== amendment.baseFingerprint) throw stale();
    const prepared = await prepareAmendment(tx, state, {
      number: amendment.number,
      lines: amendment.lines.map((l) => ({
        ...l,
        unitPrice: l.unitPrice?.toString() ?? null,
      })),
      installments: amendment.installments as unknown as StoredScheduleItem[],
    });
    if (!prepared.result.total.eq(amendment.total)) throw stale();
    return prepared;
  }

  private async lockState(tx: Tx, contractId: string) {
    await tx.$queryRaw`SELECT id FROM contracts WHERE id = ${contractId}::uuid FOR UPDATE`;
    const state = await loadContractState(tx, contractId);
    if (!AMENDABLE.includes(state.contract.status))
      throw new BadRequestException(
        'Chỉ lập/duyệt phụ lục cho hợp đồng đã duyệt, chưa thanh lý hoặc huỷ',
      );
    return state;
  }

  private async findAmendment(tx: Tx, contractId: string, id: string) {
    const amendment = await tx.contractAmendment.findFirst({
      where: { id, contractId },
      include: WITH_LINES,
    });
    if (!amendment) throw new NotFoundException('Không tìm thấy phụ lục');
    return amendment;
  }

  private async transition(
    tx: Tx,
    user: AuthUser,
    amendment: {
      id: string;
      contractId: string;
      number: number;
      title: string;
    },
    from: AmendmentStatus,
    to: AmendmentStatus,
    data: Prisma.ContractAmendmentUncheckedUpdateManyInput,
  ) {
    const { count } = await tx.contractAmendment.updateMany({
      where: { id: amendment.id, status: from },
      data: { ...data, status: to },
    });
    if (!count)
      throw new ConflictException(
        'Phụ lục vừa được người khác thay đổi; vui lòng tải lại',
      );
    const action = {
      [PENDING_APPROVAL]: 'AMENDMENT_SUBMIT',
      [APPROVED]: 'AMENDMENT_APPROVE',
      [CANCELLED]: 'AMENDMENT_CANCEL',
      [DRAFT]: 'AMENDMENT_RETURN',
    }[to];
    await this.audit(tx, user, amendment.contractId, action, amendment, {
      from,
      to,
      ...(data.returnedReason ? { reason: data.returnedReason } : {}),
    });
    return tx.contractAmendment.findUniqueOrThrow({
      where: { id: amendment.id },
      include: WITH_LINES,
    });
  }

  private async audit(
    tx: Tx,
    user: AuthUser,
    contractId: string,
    action: string,
    amendment: { id: string; number: number; title: string },
    extra: Prisma.InputJsonObject = {},
  ) {
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action,
        entity: 'contracts',
        entityId: contractId,
        detail: {
          amendmentId: amendment.id,
          number: amendmentLabel(amendment.number),
          title: amendment.title,
          ...extra,
        },
      },
    });
  }

  private async findContract(user: AuthUser, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: scopedContract(user, { id }),
      select: { id: true },
    });
    if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
  }
}
