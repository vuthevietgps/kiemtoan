import { BillingCycle, WorkflowScheduleMode } from '@prisma/client';

/**
 * Các kỳ cần sinh việc cho một dòng dịch vụ (đặc tả 05, H12). Hàm thuần.
 *
 * - Dịch vụ theo tháng/quý, lập lịch theo kỳ, HĐ có ngày kết thúc: sinh **mọi kỳ trong thời hạn HĐ**,
 *   bắt đầu từ kỳ của kế hoạch (lịch kế hoạch dời theo kỳ). Số kỳ = số tháng/quý mà thời hạn HĐ phủ.
 * - Dịch vụ theo năm/một lần, lập lịch theo dự án, HĐ chưa có ngày kết thúc, hoặc kỳ của kế hoạch
 *   khác loại với chu kỳ dịch vụ (ví dụ dịch vụ theo quý mà kế hoạch ghi tháng): giữ **một kỳ**.
 */

/** Chặn sinh vô hạn khi ngày kết thúc HĐ nhập nhầm (10 năm theo tháng). */
export const MAX_PERIODS = 120;

type Unit = 'MONTH' | 'QUARTER';

const MONTH = /^(\d{4})-(\d{2})$/;
const QUARTER = /^(\d{4})-Q([1-4])$/i;

/** Số thứ tự tuyệt đối của kỳ (năm × số kỳ/năm + chỉ số) để cộng/trừ kỳ. */
function ordinal(period: string, unit: Unit): number | null {
  const pattern = unit === 'MONTH' ? MONTH : QUARTER;
  const match = pattern.exec(period);
  if (!match) return null;
  const perYear = unit === 'MONTH' ? 12 : 4;
  return Number(match[1]) * perYear + Number(match[2]) - 1;
}

function fromOrdinal(value: number, unit: Unit): string {
  const perYear = unit === 'MONTH' ? 12 : 4;
  const year = Math.floor(value / perYear);
  const index = (value % perYear) + 1;
  return unit === 'MONTH'
    ? `${year}-${String(index).padStart(2, '0')}`
    : `${year}-Q${index}`;
}

/** Kỳ chứa một ngày (UTC, khớp cột @db.Date). */
export function periodOf(date: Date, unit: Unit): string {
  const month = date.getUTCMonth();
  return unit === 'MONTH'
    ? `${date.getUTCFullYear()}-${String(month + 1).padStart(2, '0')}`
    : `${date.getUTCFullYear()}-Q${Math.floor(month / 3) + 1}`;
}

export interface GenerationPeriodsInput {
  cycle: BillingCycle | null | undefined;
  scheduleMode: WorkflowScheduleMode | null | undefined;
  /** Kỳ của kế hoạch đã xác nhận — kỳ đầu tiên được sinh. */
  planPeriod: string;
  contractStart: Date;
  contractEnd: Date | null | undefined;
}

export function generationPeriods(input: GenerationPeriodsInput): string[] {
  const single = [input.planPeriod];
  const unit: Unit | null =
    input.cycle === BillingCycle.MONTHLY
      ? 'MONTH'
      : input.cycle === BillingCycle.QUARTERLY
        ? 'QUARTER'
        : null;
  if (!unit || input.scheduleMode !== WorkflowScheduleMode.PERIODIC)
    return single;
  if (!input.contractEnd || input.contractEnd < input.contractStart)
    return single;
  const first = ordinal(input.planPeriod, unit);
  if (first === null) return single;
  const span =
    ordinal(periodOf(input.contractEnd, unit), unit)! -
    ordinal(periodOf(input.contractStart, unit), unit)! +
    1;
  const count = Math.min(Math.max(span, 1), MAX_PERIODS);
  return Array.from({ length: count }, (_, i) => fromOrdinal(first + i, unit));
}
