import { AuditRole, AuditStage } from '@prisma/client';
import {
  auditYear,
  diffRoles,
  reportNumberKey,
  roleAssignments,
  stageMoveError,
  TeamInput,
  teamError,
} from './audit-engagement.rules';

const { NOT_STARTED, FIELDWORK, REVIEW, AWAITING_ISSUE, ISSUED } = AuditStage;

const team = (patch: Partial<TeamInput> = {}): TeamInput => ({
  managerId: 'm',
  leadId: 'l',
  signer1Id: 's1',
  signer2Id: null,
  assistantIds: ['a1', 'a2'],
  ...patch,
});

describe('stageMoveError', () => {
  it('cho tiến đúng một bước', () => {
    expect(stageMoveError(NOT_STARTED, FIELDWORK)).toBeNull();
    expect(stageMoveError(REVIEW, AWAITING_ISSUE)).toBeNull();
    expect(stageMoveError(NOT_STARTED, REVIEW)).toMatch(/kế tiếp/);
  });

  it('lùi phải có lý do 5–500 ký tự', () => {
    expect(stageMoveError(REVIEW, NOT_STARTED)).toMatch(/lý do/);
    expect(stageMoveError(REVIEW, FIELDWORK, '  ab  ')).toMatch(/lý do/);
    expect(stageMoveError(REVIEW, FIELDWORK, 'x'.repeat(501))).toMatch(/lý do/);
    expect(stageMoveError(REVIEW, NOT_STARTED, 'Khách đổi số liệu')).toBeNull();
  });

  it('không phát hành hoặc rời Đã phát hành qua API giai đoạn', () => {
    expect(stageMoveError(AWAITING_ISSUE, ISSUED)).toMatch(/Phát hành/);
    expect(stageMoveError(ISSUED, AWAITING_ISSUE, 'Sửa số liệu')).toMatch(
      /mở lại/,
    );
    expect(stageMoveError(FIELDWORK, FIELDWORK)).toMatch(/đã ở/);
  });
});

describe('reportNumberKey / auditYear', () => {
  it('so số BCKT không phân biệt hoa thường và khoảng trắng hai đầu', () => {
    expect(reportNumberKey('  300126/BCKT-TC ')).toBe(
      reportNumberKey('300126/bckt-tc'),
    );
    expect(reportNumberKey('300126/BCKT')).not.toBe(
      reportNumberKey('300126 /BCKT'),
    );
  });

  it('lấy năm từ kỳ, không có kỳ thì năm bắt đầu HĐ', () => {
    const start = new Date('2026-03-01');
    expect(auditYear('2025', start)).toBe(2025);
    expect(auditYear('2025-12', start)).toBe(2025);
    expect(auditYear('2025-Q4', start)).toBe(2025);
    expect(auditYear(null, start)).toBe(2026);
    expect(auditYear('Năm tài chính', start)).toBe(2026);
  });
});

describe('teamError', () => {
  it('nhận đội hình hợp lệ', () => {
    expect(teamError(team())).toBeNull();
    expect(teamError(team({ signer1Id: 'm' }))).toBeNull();
  });

  it('chặn một người hai vai, ký 2 không có ký 1, hai người ký trùng, quá 10 trợ lý', () => {
    expect(teamError(team({ leadId: 'm' }))).toMatch(/hai vai/);
    expect(teamError(team({ assistantIds: ['a1', 'a1'] }))).toMatch(/hai vai/);
    expect(teamError(team({ assistantIds: ['l'] }))).toMatch(/hai vai/);
    expect(teamError(team({ signer1Id: null, signer2Id: 's2' }))).toMatch(
      /ký 1 trước/,
    );
    expect(teamError(team({ signer2Id: 's1' }))).toMatch(/khác nhau/);
    expect(
      teamError(
        team({ assistantIds: Array.from({ length: 11 }, (_, i) => `a${i}`) }),
      ),
    ).toMatch(/Tối đa/);
  });
});

describe('diffRoles', () => {
  it('đóng vai bị đổi người, mở vai mới, giữ nguyên vai không đổi', () => {
    const before = roleAssignments(team());
    const after = roleAssignments(
      team({ leadId: 'l2', assistantIds: ['a2', 'a3'] }),
    );
    const { closed, opened } = diffRoles(before, after);
    expect(closed).toEqual([
      { role: AuditRole.LEAD, userId: 'l' },
      { role: AuditRole.ASSISTANT, userId: 'a1' },
    ]);
    expect(opened).toEqual([
      { role: AuditRole.LEAD, userId: 'l2' },
      { role: AuditRole.ASSISTANT, userId: 'a3' },
    ]);
  });
});
