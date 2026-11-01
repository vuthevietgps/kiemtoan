import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { hasPermission } from '../../core/access-control/permissions';
import type { AuthUser } from '../../core/auth/auth-user.interface';
import { CapabilityService } from './capability.service';
import {
  CapabilityQueryDto,
  OperationsReportQueryDto,
  RevenueMeasuresQueryDto,
} from './dto/report-query.dto';
import { FinanceReportsService } from './finance-reports.service';
import { OperationsReportsService } from './operations-reports.service';
import { capabilityXlsx } from './utils/capability-xlsx';
import {
  complianceXlsx,
  contractsXlsx,
  customersXlsx,
} from './utils/operations-report-xlsx';
import { revenueXlsx } from './utils/revenue-export';

/** Báo cáo lưu được bộ lọc / hẹn gửi. Công nợ, Hoá đơn dùng màn hình và bộ lọc riêng của 07 / 08. */
export const REPORT_KEYS = [
  'revenue',
  'deadline-compliance',
  'contracts',
  'customers',
  'capability',
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

const OPERATIONS_PARAMS = ['from', 'to', 'customerId'];

/** Tham số được lưu của từng báo cáo: chỉ các khoá này (không bao giờ lưu `token`, `format`). */
const REPORT_SPEC = {
  revenue: {
    title: 'Doanh thu',
    params: ['from', 'to', 'groupBy', 'customerId'],
    dto: RevenueMeasuresQueryDto,
  },
  'deadline-compliance': {
    title: 'Tuân thủ deadline',
    params: OPERATIONS_PARAMS,
    dto: OperationsReportQueryDto,
  },
  contracts: {
    title: 'Hợp đồng',
    params: OPERATIONS_PARAMS,
    dto: OperationsReportQueryDto,
  },
  customers: {
    title: 'Khách hàng',
    params: OPERATIONS_PARAMS,
    dto: OperationsReportQueryDto,
  },
  capability: {
    title: 'Đánh giá năng lực',
    params: ['from', 'to', 'role', 'domain', 'teamId'],
    dto: CapabilityQueryDto,
  },
} as const;

export interface ReportFile {
  buffer: Buffer;
  fileName: string;
}

/**
 * Một cửa vào cho bộ lọc đã lưu và lượt gửi định kỳ (10-F): kiểm tham số, kiểm quyền xem theo người,
 * tạo đúng file Excel như nút Xuất trên màn hình (cùng service, cùng phạm vi dữ liệu của người đó).
 */
@Injectable()
export class ReportExporterService {
  constructor(
    private readonly finance: FinanceReportsService,
    private readonly operations: OperationsReportsService,
    private readonly capability: CapabilityService,
  ) {}

  titleOf(report: ReportKey): string {
    return REPORT_SPEC[report].title;
  }

  /** Quyền xem báo cáo; báo cáo tài chính cần cả `finance:view` như guard. */
  canView(user: AuthUser, report: ReportKey): boolean {
    return report === 'revenue'
      ? hasPermission(user, 'reports', 'view_financial') &&
          hasPermission(user, 'finance', 'view')
      : hasPermission(user, 'reports', 'view_operations');
  }

  /** Gửi định kỳ / tải Excel: quyền xuất và quyền xem báo cáo đó, tính tại thời điểm gọi. */
  canExport(user: AuthUser, report: ReportKey): boolean {
    return (
      hasPermission(user, 'reports', 'export') && this.canView(user, report)
    );
  }

  /** Tham số hợp lệ của báo cáo: khoá lạ bị từ chối, giá trị kiểm bằng đúng DTO của API báo cáo. */
  async cleanParams(
    report: ReportKey,
    raw: Record<string, unknown>,
  ): Promise<Record<string, string>> {
    const spec = REPORT_SPEC[report];
    const allowed: readonly string[] = spec.params;
    const unknown = Object.keys(raw).filter((k) => !allowed.includes(k));
    if (unknown.length)
      throw new BadRequestException(
        `Tham số không dùng cho báo cáo này: ${unknown.join(', ')}`,
      );
    const entries = Object.entries(raw).filter(
      ([, v]) => v !== null && v !== undefined && v !== '',
    );
    const clean = Object.fromEntries(entries);
    const errors = await validate(plainToInstance(spec.dto, clean) as object);
    if (errors.length)
      throw new BadRequestException(
        Object.values(errors[0].constraints ?? {})[0] ?? 'Tham số không hợp lệ',
      );
    return clean as Record<string, string>;
  }

  async build(
    report: ReportKey,
    params: Record<string, string>,
    user: AuthUser,
  ): Promise<ReportFile> {
    switch (report) {
      case 'revenue':
        return {
          buffer: revenueXlsx(await this.finance.revenue(params, user)),
          fileName: 'bao-cao-doanh-thu.xlsx',
        };
      case 'deadline-compliance':
        return {
          buffer: complianceXlsx(
            await this.operations.deadlineCompliance(params, user),
          ),
          fileName: 'tuan-thu-deadline.xlsx',
        };
      case 'contracts':
        return {
          buffer: contractsXlsx(await this.operations.contracts(params, user)),
          fileName: 'bao-cao-hop-dong.xlsx',
        };
      case 'customers':
        return {
          buffer: customersXlsx(await this.operations.customers(params, user)),
          fileName: 'bao-cao-khach-hang.xlsx',
        };
      case 'capability':
        return {
          buffer: capabilityXlsx(await this.capability.report(params, user)),
          fileName: 'danh-gia-nang-luc.xlsx',
        };
    }
  }
}
