import { describe, expect, it } from 'vitest';
import type { RuleInput } from './data-access/deadline-settings.api';
import { ruleSummary } from './rule-summary';

const rule = (patch: Partial<RuleInput> = {}): RuleInput => ({
  effectiveFrom: '2026-11-01',
  dueRule: 'MONTH_AFTER_END',
  monthsAfter: 1,
  dueMonth: null,
  dueDay: 20,
  useFiscalYear: false,
  holidayShift: 'NEXT',
  conditions: {},
  legalBasis: null,
  note: null,
  ...patch,
});

describe('ruleSummary (06-D3)', () => {
  it('ngày N tháng thứ K sau kỳ, dời ngày nghỉ, ngày hiệu lực', () => {
    expect(ruleSummary(rule())).toBe(
      'Hạn ngày 20 của tháng thứ 1 sau tháng cuối kỳ; trùng ngày nghỉ: sang ngày làm việc kế tiếp; áp dụng cho kỳ kết thúc từ 01/11/2026',
    );
  });

  it('ngày 31 = ngày cuối tháng; ngày cố định trong năm; năm tài chính; điều kiện', () => {
    expect(
      ruleSummary(
        rule({
          dueRule: 'FIXED_IN_YEAR',
          dueMonth: 3,
          dueDay: 31,
          useFiscalYear: true,
          holidayShift: 'PREVIOUS',
          conditions: { taxPeriod: ['QUARTERLY'], vatMethod: ['DEDUCTION', 'DIRECT'] },
        }),
      ),
    ).toBe(
      'Hạn ngày cuối tháng tháng 3 của năm sau kỳ; trùng ngày nghỉ: về ngày làm việc trước; áp dụng cho kỳ kết thúc từ 01/11/2026; kỳ năm theo năm tài chính của KH; chỉ khi Kỳ khai GTGT: Theo quý; Phương pháp GTGT: Khấu trừ, Trực tiếp',
    );
  });
});
