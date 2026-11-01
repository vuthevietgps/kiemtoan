import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { hasPermission } from '../../core/access-control/permissions';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditPeopleQuery } from '../contracts/audit-engagements/audit-people.query';
import { loadWorkingCalendar } from '../deadlines/working-calendar.loader';
import { CapabilityTasksQuery } from './capability-tasks.query';
import { CapabilityTeamQuery } from './capability-team.query';
import { CapabilityQueryDto } from './dto/report-query.dto';
import { ratePercent } from './utils/capability.rules';
import {
  currentYear,
  formatBusinessDate,
  resolvePeriod,
  todayVn,
} from './utils/period.util';

type Person = { id: string; fullName: string; teamId: string | null };

/**
 * Báo cáo Đánh giá năng lực (đặc tả 10-E; khung G1–G10): tab Trợ lý / Trưởng nhóm / Manager, mảng kế
 * toán / kiểm toán / cả hai (không cộng hai mảng thành một số), mỗi chỉ số một cột, ô bấm ra danh sách.
 * Phạm vi xem G9: Giám đốc tất cả, KTT người trong nhóm, nhân viên chỉ chính mình. Không có số tiền.
 */
@Injectable()
export class CapabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: CapabilityTasksQuery,
    private readonly team: CapabilityTeamQuery,
    private readonly audit: AuditPeopleQuery,
  ) {}

  async report(query: CapabilityQueryDto, user: AuthUser) {
    const period = resolvePeriod(query.from, query.to, currentYear());
    const role = query.role ?? 'ASSISTANT';
    const domain = query.domain ?? 'ALL';
    const people = await this.visibleUsers(user, query.teamId);
    const ids = [...people.keys()];
    const today = todayVn();
    const base = {
      from: formatBusinessDate(period.from),
      to: formatBusinessDate(period.to),
      role,
      domain,
    };
    if (role === 'ASSISTANT') {
      const stats = await this.tasks.assistants(ids, period, domain, today);
      return {
        ...base,
        rows: ids
          .map((id) => ({ user: people.get(id)!, ...stats.get(id)! }))
          .filter((r) => r.total || r.accepted || r.openCustomers)
          .sort(byName),
      };
    }
    const accounting =
      domain === 'AUDIT'
        ? []
        : await this.team.periods(ids, role, period, today);
    const audit =
      domain === 'ACCOUNTING'
        ? null
        : await this.auditSummary(user, base, role);
    const calendar = await loadWorkingCalendar(this.prisma);
    const reviews =
      role === 'LEAD' ? await this.team.reviews(ids, period, calendar) : [];
    const overSla =
      role === 'LEAD'
        ? await this.team.overSlaNow(ids, calendar)
        : new Map<string, number>();
    const rows = ids.map((id) => {
      const mine = reviews.filter((r) => r.reviewerId === id);
      return {
        user: people.get(id)!,
        periods: this.team.summarizePeriods(
          accounting.filter((r) => r.userId === id),
        ),
        audit: audit?.get(id) ?? null,
        ...(role === 'LEAD' && {
          reviews: {
            count: mine.length,
            avgDays: mine.length
              ? Math.round(
                  (mine.reduce((n, r) => n + r.days, 0) / mine.length) * 10,
                ) / 10
              : null,
            withinSla: mine.filter((r) => r.withinSla).length,
            slaRate: ratePercent(
              mine.filter((r) => r.withinSla).length,
              mine.length,
            ),
            returned: mine.filter((r) => r.decision === 'RETURN').length,
            overSlaNow: overSla.get(id) ?? 0,
          },
        }),
      };
    });
    return {
      ...base,
      rows: rows
        .filter(
          (r) =>
            r.periods.total ||
            r.audit?.total ||
            r.reviews?.count ||
            r.reviews?.overSlaNow,
        )
        .sort(byName),
    };
  }

  /** Danh sách được tính cho một người — để tái lập từng con số trên dòng. */
  async items(userId: string, query: CapabilityQueryDto, user: AuthUser) {
    const people = await this.visibleUsers(user, query.teamId);
    const person = people.get(userId);
    if (!person)
      throw new ForbiddenException('Bạn không được xem số liệu của người này');
    const period = resolvePeriod(query.from, query.to, currentYear());
    const role = query.role ?? 'ASSISTANT';
    const domain = query.domain ?? 'ALL';
    const today = todayVn();
    if (role === 'ASSISTANT')
      return {
        user: person,
        role,
        tasks: await this.tasks.items(userId, period, domain, today),
      };
    const calendar = await loadWorkingCalendar(this.prisma);
    const periods =
      domain === 'AUDIT'
        ? []
        : await this.team.periods([userId], role, period, today);
    const audit =
      domain === 'ACCOUNTING'
        ? []
        : (
            await this.audit.person(user, userId, {
              from: formatBusinessDate(period.from),
              to: formatBusinessDate(period.to),
              role,
            })
          ).items;
    const reviews =
      role === 'LEAD'
        ? await this.team.reviews([userId], period, calendar)
        : [];
    return {
      user: person,
      role,
      periods: this.team.periodItems(periods),
      audit,
      reviews: reviews.map((r) => ({
        task: r.task,
        decision: r.decision,
        enteredAt: r.enteredAt,
        decidedAt: r.decidedAt,
        days: r.days,
        withinSla: r.withinSla,
      })),
    };
  }

  private async auditSummary(
    user: AuthUser,
    base: { from: string; to: string },
    role: 'LEAD' | 'MANAGER',
  ) {
    const res = await this.audit.people(user, {
      from: base.from,
      to: base.to,
      role,
    });
    return new Map(
      res.items.map((i) => [
        i.user.id,
        {
          total: i.total,
          onTime: i.onTime,
          late: i.late,
          overdue: i.overdue,
          rate: i.rate,
          rateOriginal: i.rateOriginal,
          extensions: i.extensions,
          activeEngagements: i.activeEngagements,
        },
      ]),
    );
  }

  /** G9 (như F11 của 04-F): Giám đốc tất cả; KTT người trong nhóm mình; nhân viên chỉ chính mình. */
  private async visibleUsers(user: AuthUser, teamId?: string) {
    const all = hasPermission(user, 'contracts', 'approve');
    const team = hasPermission(user, 'contracts', 'plan') && user.teamId;
    const where: Prisma.UserWhereInput = all
      ? {}
      : team
        ? { OR: [{ teamId: user.teamId }, { id: user.id }] }
        : { id: user.id };
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          where,
          teamId ? { teamId } : {},
          { deletedAt: null, role: { notIn: [Role.ADMIN, Role.CASHIER] } },
        ],
      },
      select: { id: true, fullName: true, teamId: true },
    });
    return new Map<string, Person>(users.map((u) => [u.id, u]));
  }
}

const byName = (a: { user: Person }, b: { user: Person }) =>
  a.user.fullName.localeCompare(b.user.fullName, 'vi');
