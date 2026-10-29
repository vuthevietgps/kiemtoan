import { buildWorkingCalendar } from '../../common/working-calendar';
import {
  type DueRuleInput,
  dueRuleError,
  matchesConditions,
  obligationPeriodForTask,
  parseConditions,
  periodContaining,
  periodEndOf,
  periodsEndingBetween,
  periodStartOf,
  rawDueDate,
  statutoryDueDate,
  versionForPeriod,
} from './obligation.rules';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

// Quy tắc ví dụ để test cơ chế — không phải danh mục pháp lý đã xác nhận (QD07).
const rule = (patch: Partial<DueRuleInput>): DueRuleInput => ({
  dueRule: 'MONTH_AFTER_END',
  monthsAfter: 1,
  dueMonth: null,
  dueDay: 20,
  useFiscalYear: true,
  holidayShift: 'NEXT',
  ...patch,
});
const noHoliday = buildWorkingCalendar({ confirmedYears: [], days: [] });

describe('Quy tắc kỳ nghĩa vụ (06, I1/I5)', () => {
  it('ngày cuối/đầu kỳ tháng, quý, năm tài chính lệch', () => {
    expect(iso(periodEndOf('MONTHLY', '2028-02'))).toBe('2028-02-29');
    expect(iso(periodEndOf('QUARTERLY', '2026-Q3'))).toBe('2026-09-30');
    expect(iso(periodEndOf('YEARLY', '2026'))).toBe('2026-12-31');
    expect(iso(periodEndOf('YEARLY', '2026', 3))).toBe('2026-03-31');
    expect(iso(periodStartOf('YEARLY', '2026', 3))).toBe('2025-04-01');
    expect(iso(periodStartOf('QUARTERLY', '2026-Q1'))).toBe('2026-01-01');
  });

  it('kỳ chứa một ngày và các kỳ kết thúc trong khoảng', () => {
    expect(periodContaining('QUARTERLY', d('2026-05-10'))).toBe('2026-Q2');
    expect(periodContaining('YEARLY', d('2026-05-10'), 3)).toBe('2027');
    expect(periodContaining('YEARLY', d('2026-02-10'), 3)).toBe('2026');
    expect(
      periodsEndingBetween('MONTHLY', d('2026-10-15'), d('2027-01-31')),
    ).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
    expect(
      periodsEndingBetween('QUARTERLY', d('2026-10-01'), d('2027-06-29')),
    ).toEqual(['2026-Q4', '2027-Q1']);
    expect(
      periodsEndingBetween('YEARLY', d('2026-01-01'), d('2027-12-31'), 6),
    ).toEqual(['2026', '2027']);
  });

  it('hạn theo quy tắc: ngày N tháng thứ K sau kỳ, ngày cuối tháng, ngày cố định trong năm', () => {
    const monthly = rule({});
    expect(iso(rawDueDate(monthly, '2026-10', d('2026-10-31')))).toBe(
      '2026-11-20',
    );
    const quarterly = rule({ dueDay: 31 });
    expect(iso(rawDueDate(quarterly, '2026-Q1', d('2026-03-31')))).toBe(
      '2026-04-30',
    );
    const annual = rule({ monthsAfter: 3, dueDay: 31 });
    expect(iso(rawDueDate(annual, '2026', d('2026-12-31')))).toBe('2027-03-31');
    expect(iso(rawDueDate(annual, '2026', d('2026-03-31')))).toBe('2026-06-30');
    // Kỳ tháng 12/2027 + 2 tháng, ngày 31 → 29/02/2028 (năm nhuận).
    expect(
      iso(
        rawDueDate(
          rule({ monthsAfter: 2, dueDay: 31 }),
          '2027-12',
          d('2027-12-31'),
        ),
      ),
    ).toBe('2028-02-29');
    const fixed = rule({ dueRule: 'FIXED_IN_YEAR', dueMonth: 1, dueDay: 30 });
    expect(iso(rawDueDate(fixed, '2027', d('2027-12-31')))).toBe('2027-01-30');
  });

  it('I3: hạn pháp lý trùng ngày nghỉ sang ngày làm việc kế tiếp (hoặc trước nếu cấu hình)', () => {
    // 20/09/2026 là Chủ nhật.
    const end = d('2026-08-31');
    expect(iso(statutoryDueDate(rule({}), '2026-08', end, noHoliday))).toBe(
      '2026-09-21',
    );
    expect(
      iso(
        statutoryDueDate(
          rule({ holidayShift: 'PREVIOUS' }),
          '2026-08',
          end,
          noHoliday,
        ),
      ),
    ).toBe('2026-09-18');
    const tet = buildWorkingCalendar({
      confirmedYears: [2027],
      days: ['2027-02-19', '2027-02-22'].map((s) => ({
        date: d(s),
        kind: 'DAY_OFF' as const,
      })),
    });
    // 20/02/2027 thứ 7 → 22/02 nghỉ → 23/02.
    expect(
      iso(statutoryDueDate(rule({}), '2027-01', d('2027-01-31'), tet)),
    ).toBe('2027-02-23');
  });

  it('I6: kỳ nghĩa vụ của việc chỉ khi cùng ngày cuối kỳ', () => {
    expect(
      obligationPeriodForTask('QUARTERLY', '2026-03', d('2026-03-31'), 12),
    ).toBe('2026-Q1');
    expect(
      obligationPeriodForTask('QUARTERLY', '2026-02', d('2026-02-28'), 12),
    ).toBeNull();
    expect(
      obligationPeriodForTask('MONTHLY', '2026-Q1', d('2026-03-31'), 12),
    ).toBe('2026-03');
    expect(obligationPeriodForTask('YEARLY', '2026', d('2026-12-31'), 3)).toBe(
      '2026',
    );
  });

  it('điều kiện áp dụng theo hồ sơ KH; trường trống không thoả điều kiện có liệt kê', () => {
    const profile = {
      taxPeriod: 'QUARTERLY',
      vatMethod: 'DEDUCTION',
      pitPeriod: null,
      accountingRegime: 'TT133',
      fiscalYearEndMonth: 12,
    };
    expect(matchesConditions({ taxPeriod: ['QUARTERLY'] }, profile)).toBe(true);
    expect(matchesConditions({ taxPeriod: ['MONTHLY'] }, profile)).toBe(false);
    expect(matchesConditions({ pitPeriod: ['MONTHLY'] }, profile)).toBe(false);
    expect(matchesConditions({}, profile)).toBe(true);
  });

  it('đọc điều kiện và kiểm tra quy tắc báo lỗi tiếng Việt', () => {
    expect(parseConditions({ vatMethod: ['DIRECT', 'DIRECT'] })).toEqual({
      vatMethod: ['DIRECT'],
    });
    expect(parseConditions({ foo: ['x'] })).toContain('trường lạ');
    expect(parseConditions({ taxPeriod: ['YEARLY'] })).toContain(
      'không hợp lệ',
    );
    expect(parseConditions([])).toContain('không hợp lệ');
    expect(dueRuleError('MONTHLY', rule({ dueDay: 0 }))).toContain('Ngày hạn');
    expect(dueRuleError('MONTHLY', rule({ monthsAfter: null }))).toContain(
      'Số tháng',
    );
    expect(
      dueRuleError('MONTHLY', rule({ dueRule: 'FIXED_IN_YEAR', dueMonth: 1 })),
    ).toContain('theo năm');
    expect(
      dueRuleError('YEARLY', rule({ dueRule: 'FIXED_IN_YEAR', dueMonth: 13 })),
    ).toContain('Tháng hạn');
    expect(dueRuleError('QUARTERLY', rule({ dueDay: 31 }))).toBeNull();
  });

  it('phiên bản áp cho kỳ: mới nhất có ngày hiệu lực ≤ ngày cuối kỳ', () => {
    const versions = [
      { id: 'v1', versionNo: 1, effectiveFrom: d('2026-01-01') },
      { id: 'v2', versionNo: 2, effectiveFrom: d('2027-01-01') },
    ];
    expect(versionForPeriod(versions, d('2026-12-31'))?.id).toBe('v1');
    expect(versionForPeriod(versions, d('2027-01-31'))?.id).toBe('v2');
    expect(versionForPeriod(versions, d('2025-12-31'))).toBeNull();
  });
});
