import type { ObligationTypeVersion } from '@prisma/client';
import { buildWorkingCalendar } from '../../common/working-calendar';
import { desiredObligations, type SyncInput } from './obligation-sync';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

// Loại nghĩa vụ ví dụ cho test cơ chế (không phải quy định đã xác nhận).
const version = (
  patch: Partial<ObligationTypeVersion> = {},
): ObligationTypeVersion => ({
  id: 'v1',
  typeId: 'vat-m',
  versionNo: 1,
  status: 'CONFIRMED',
  revision: 1,
  effectiveFrom: d('2026-01-01'),
  dueRule: 'MONTH_AFTER_END',
  monthsAfter: 1,
  dueMonth: null,
  dueDay: 20,
  useFiscalYear: true,
  holidayShift: 'NEXT',
  conditions: { taxPeriod: ['MONTHLY'] },
  legalBasis: null,
  note: null,
  createdById: null,
  confirmedById: null,
  confirmedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...patch,
});

const base = (patch: Partial<SyncInput> = {}): SyncInput => ({
  profile: {
    taxPeriod: 'MONTHLY',
    vatMethod: 'DEDUCTION',
    pitPeriod: null,
    accountingRegime: null,
    fiscalYearEndMonth: 12,
  },
  active: true,
  types: [
    {
      id: 'vat-m',
      cycle: 'MONTHLY',
      serviceTypeIds: ['svc-ktt'],
      versions: [version()],
    },
  ],
  lines: [
    { serviceTypeId: 'svc-ktt', from: d('2026-01-01'), to: d('2026-12-31') },
  ],
  settings: new Map(),
  today: d('2026-10-23'),
  calendar: buildWorkingCalendar({ confirmedYears: [], days: [] }),
  ...patch,
});

describe('desiredObligations (06, I4)', () => {
  it('sinh kỳ trong thời hạn HĐ có dịch vụ gắn loại, bỏ kỳ đã qua hạn', () => {
    const result = desiredObligations(base());
    // Kỳ 09/2026 hạn 20/10 đã qua → không sinh bù; còn 10, 11, 12.
    expect(result.map((r) => [r.period, iso(r.dueDate)])).toEqual([
      ['2026-10', '2026-11-20'],
      ['2026-11', '2026-12-21'], // 20/12/2026 Chủ nhật → thứ 2
      ['2026-12', '2027-01-20'],
    ]);
  });

  it('KH không đang phục vụ, không có dịch vụ gắn, hoặc không thoả điều kiện → không sinh', () => {
    expect(desiredObligations(base({ active: false }))).toEqual([]);
    expect(
      desiredObligations(
        base({
          lines: [{ serviceTypeId: 'other', from: d('2026-01-01'), to: null }],
        }),
      ),
    ).toEqual([]);
    expect(
      desiredObligations(
        base({ profile: { ...base().profile, taxPeriod: 'QUARTERLY' } }),
      ),
    ).toEqual([]);
  });

  it('tắt riêng cho KH thì không sinh; bật riêng thì sinh dù không có dịch vụ, trong tầm sinh', () => {
    const off = new Map([
      ['vat-m', { enabled: false, since: d('2026-10-01') }],
    ]);
    expect(desiredObligations(base({ settings: off }))).toEqual([]);
    const on = new Map([['vat-m', { enabled: true, since: d('2026-10-01') }]]);
    const result = desiredObligations(base({ lines: [], settings: on }));
    expect(result[0].period).toBe('2026-10');
    // Tầm sinh 400 ngày: kỳ cuối kết thúc trước 27/11/2027.
    expect(result.at(-1)!.period).toBe('2027-10');
  });

  it('hồi quy 06-D2: bật lại loại đã có dịch vụ trong HĐ thì chỉ sinh trong thời hạn HĐ, không tới tầm sinh', () => {
    const on = new Map([['vat-m', { enabled: true, since: d('2026-10-20') }]]);
    const result = desiredObligations(base({ settings: on }));
    expect(result.map((r) => r.period)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
  });

  it('HĐ không có ngày kết thúc sinh tới tầm sinh; phiên bản chưa hiệu lực thì không sinh kỳ đó', () => {
    const result = desiredObligations(
      base({
        lines: [{ serviceTypeId: 'svc-ktt', from: d('2026-01-01'), to: null }],
        types: [
          {
            id: 'vat-m',
            cycle: 'MONTHLY',
            serviceTypeIds: ['svc-ktt'],
            versions: [version({ effectiveFrom: d('2026-12-01') })],
          },
        ],
      }),
    );
    expect(result[0].period).toBe('2026-12');
    expect(result.length).toBe(11);
  });
});
