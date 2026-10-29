import { DocumentCategory, DocumentRequestStatus } from '@prisma/client';
import { confirmedWaitDays } from './client-wait.rules';
import {
  missingDocuments,
  requestActionError,
  requestDrafts,
} from './document-request.rules';

const S = DocumentRequestStatus;
const t = (iso: string) => new Date(iso);

describe('hồ sơ yêu cầu (05-D)', () => {
  const requirement = (
    id: string,
    perPeriod: boolean,
    stepKey: string | null,
  ) => ({
    id,
    name: `Hồ sơ ${id}`,
    instructions: null,
    required: true,
    category: DocumentCategory.SERVICE,
    perPeriod,
    stepKey,
  });

  it('theo kỳ sinh cho từng kỳ; một lần sinh một bản ở kỳ đầu', () => {
    const drafts = requestDrafts(
      [requirement('a', true, 'B01'), requirement('b', false, null)],
      ['2026-01', '2026-02'],
    );
    expect(drafts.map((d) => [d.planRequirementId, d.period])).toEqual([
      ['a', '2026-01'],
      ['a', '2026-02'],
      ['b', '2026-01'],
    ]);
    expect(requestDrafts([requirement('a', true, null)], [])).toEqual([]);
  });

  it('chuyển trạng thái đúng 6 bước; tải lên được nhiều lần; chấp nhận rồi thì khoá', () => {
    expect(requestActionError('REQUEST', S.NOT_REQUESTED)).toBeNull();
    expect(requestActionError('REQUEST', S.NEEDS_SUPPLEMENT)).toBeNull();
    expect(requestActionError('UPLOAD', S.UPLOADED)).toBeNull();
    expect(requestActionError('REVIEW', S.REQUESTED)).toMatch(/Đã yêu cầu/);
    expect(requestActionError('SUPPLEMENT', S.IN_REVIEW)).toBeNull();
    expect(requestActionError('ACCEPT', S.REQUESTED)).not.toBeNull();
    for (const action of [
      'REQUEST',
      'UPLOAD',
      'REVIEW',
      'SUPPLEMENT',
      'ACCEPT',
    ] as const)
      expect(requestActionError(action, S.ACCEPTED)).not.toBeNull();
  });

  it('H4: chặn theo hồ sơ bắt buộc của bước cùng kỳ hoặc hồ sơ một lần; tuỳ chọn và đã chấp nhận không chặn', () => {
    const gate = (
      name: string,
      extra: Partial<Parameters<typeof missingDocuments>[1][number]>,
    ) => ({
      name,
      stepKey: 'B01',
      period: '2026-01',
      perPeriod: true,
      required: true,
      status: S.REQUESTED,
      ...extra,
    });
    const requests = [
      gate('Sao kê T1', {}),
      gate('Sao kê T2', { period: '2026-02' }),
      gate('GPKD', { perPeriod: false }),
      gate('Tuỳ chọn', { required: false }),
      gate('Đã có', { status: S.ACCEPTED }),
      gate('Bước khác', { stepKey: 'B02' }),
    ];
    expect(
      missingDocuments({ stepKey: 'B01', period: '2026-02' }, requests),
    ).toEqual(['Sao kê T2', 'GPKD']);
    expect(
      missingDocuments({ stepKey: null, period: '2026-01' }, requests),
    ).toEqual([]);
  });
});

describe('confirmedWaitDays (G5)', () => {
  const wait = (from: string, to: string | null, confirmed = true) => ({
    startedAt: t(from),
    endedAt: to ? t(to) : null,
    confirmedAt: confirmed ? t('2026-03-01T00:00:00Z') : null,
  });

  it('chỉ khoảng đã xác nhận và đã kết thúc; ngày theo giờ Việt Nam', () => {
    expect(
      confirmedWaitDays([
        wait('2026-01-01T02:00:00Z', '2026-01-04T02:00:00Z'),
        wait('2026-01-10T00:00:00Z', '2026-01-12T00:00:00Z', false),
        wait('2026-01-20T00:00:00Z', null),
      ]),
    ).toBe(3);
    // 23:30 UTC = 06:30 hôm sau giờ VN → cùng ngày VN với 01:00 UTC hôm sau.
    expect(
      confirmedWaitDays([wait('2026-01-01T23:30:00Z', '2026-01-02T01:00:00Z')]),
    ).toBe(0);
  });

  it('các khoảng chồng nhau không đếm trùng', () => {
    expect(
      confirmedWaitDays([
        wait('2026-01-01T00:00:00Z', '2026-01-05T00:00:00Z'),
        wait('2026-01-03T00:00:00Z', '2026-01-08T00:00:00Z'),
        wait('2026-01-20T00:00:00Z', '2026-01-21T00:00:00Z'),
      ]),
    ).toBe(8);
  });
});
