import { ReportScheduleFrequency as F } from '@prisma/client';
import {
  scheduleDue,
  scheduleKey,
  schedulePeriod,
  sendMoment,
} from './report-schedule.rules';

const at = (iso: string) => new Date(iso);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const longAgo = at('2020-01-01T00:00:00Z');

describe('report schedule rules (M12)', () => {
  it('khoá tuần là thứ 2 theo lịch VN; Chủ nhật vẫn thuộc tuần đó', () => {
    // 02/11/2026 là thứ 2.
    expect(scheduleKey(F.WEEKLY, at('2026-11-04T03:00:00Z'))).toEqual(
      day('2026-11-02'),
    );
    expect(scheduleKey(F.WEEKLY, at('2026-11-08T03:00:00Z'))).toEqual(
      day('2026-11-02'),
    );
  });

  it('biên ngày VN: 17:30 UTC Chủ nhật đã là thứ 2 giờ VN', () => {
    expect(scheduleKey(F.WEEKLY, at('2026-11-01T17:30:00Z'))).toEqual(
      day('2026-11-02'),
    );
    expect(scheduleKey(F.MONTHLY, at('2026-10-31T17:30:00Z'))).toEqual(
      day('2026-11-01'),
    );
  });

  it('gửi lúc 07:30 giờ VN = 00:30 UTC', () => {
    expect(sendMoment(day('2026-11-02'))).toEqual(at('2026-11-02T00:30:00Z'));
  });

  it('trước 07:30 chưa đến lượt, từ 07:30 trở đi đến lượt (gửi bù khi máy dừng)', () => {
    expect(
      scheduleDue(F.WEEKLY, longAgo, at('2026-11-02T00:29:00Z')),
    ).toBeNull();
    expect(scheduleDue(F.WEEKLY, longAgo, at('2026-11-02T00:30:00Z'))).toEqual(
      day('2026-11-02'),
    );
    expect(scheduleDue(F.WEEKLY, longAgo, at('2026-11-05T09:00:00Z'))).toEqual(
      day('2026-11-02'),
    );
  });

  it('bật lịch sau mốc gửi thì không gửi ngay, chờ mốc sau', () => {
    const activeFrom = at('2026-11-03T03:00:00Z');
    expect(
      scheduleDue(F.WEEKLY, activeFrom, at('2026-11-05T09:00:00Z')),
    ).toBeNull();
    expect(
      scheduleDue(F.WEEKLY, activeFrom, at('2026-11-09T01:00:00Z')),
    ).toEqual(day('2026-11-09'));
  });

  it('kỳ số liệu: tuần trước; tháng trước, kể cả qua năm và tháng 2', () => {
    expect(schedulePeriod(F.WEEKLY, day('2026-11-02'))).toEqual({
      from: '2026-10-26',
      to: '2026-11-01',
    });
    expect(schedulePeriod(F.MONTHLY, day('2026-11-01'))).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(schedulePeriod(F.MONTHLY, day('2027-01-01'))).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
    expect(schedulePeriod(F.MONTHLY, day('2028-03-01'))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
  });
});
