import { WEEKDAY_CALENDAR } from '../../common/working-calendar';
import {
  credentialSubject,
  expiryTitle,
  loanEscalationDate,
} from './credential-reminders';
import type { PlanContext } from './reminder-planner';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('credential-reminders (09-C, L9)', () => {
  it('tiêu đề token / tài khoản không chứa bí mật, có KH', () => {
    const customer = { name: 'Công ty A', ownerId: 'u1' };
    expect(
      credentialSubject({
        id: '1',
        type: 'DIGITAL_SIGNATURE',
        label: 'Token',
        username: null,
        provider: 'VNPT_CA',
        serialNumber: 'TK-01',
        customer,
      }),
    ).toBe('Chữ ký số VNPT-CA TK-01 — Công ty A');
    expect(
      credentialSubject({
        id: '2',
        type: 'TAX_PORTAL',
        label: 'Thuế điện tử',
        username: '0101',
        provider: null,
        serialNumber: null,
        customer,
      }),
    ).toBe('Thuế điện tử (0101) — Công ty A');
  });

  it('tiêu đề ghi đúng số ngày còn lại (kể cả mốc gửi bù); đúng ngày → "Hết hạn hôm nay"', () => {
    expect(
      expiryTitle('Sắp đến hạn', 'Token X', d('2027-04-04'), d('2027-03-10')),
    ).toBe('Sắp đến hạn (còn 25 ngày): Token X, hạn 04/04/2027');
    expect(expiryTitle('x', 'Token X', d('2027-03-10'), d('2027-03-10'))).toBe(
      'Hết hạn hôm nay: Token X, hạn 10/03/2027',
    );
  });

  it('báo người phụ trách từ ngày làm việc đầu tiên sau hạn trả (hạn thứ 6 → thứ 2)', () => {
    const ctx = { calendar: WEEKDAY_CALENDAR } as PlanContext;
    expect(loanEscalationDate(d('2027-03-09'), ctx)).toEqual(d('2027-03-10'));
    expect(loanEscalationDate(d('2027-03-05'), ctx)).toEqual(d('2027-03-08'));
  });
});
