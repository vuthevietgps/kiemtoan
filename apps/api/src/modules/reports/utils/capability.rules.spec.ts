import {
  assistantOutcome,
  clientWaitDays,
  holderAt,
  momentOf,
  onTimeRate,
  periodOutcome,
  PeriodTask,
  TaskFacts,
} from './capability.rules';
import { toBusinessDate } from './period.util';

const d = toBusinessDate;
const today = d('2026-06-30');

const task = (patch: Partial<TaskFacts> = {}): TaskFacts => ({
  dueDate: d('2026-06-10'),
  originalDueDate: d('2026-06-10'),
  isStatutory: false,
  reviewLevels: 1,
  firstSubmittedAt: null,
  acceptedAt: null,
  completedAt: null,
  legacy: false,
  returnCount: 0,
  waits: [],
  ...patch,
});

describe('capability rules — trợ lý (G2, G4–G6)', () => {
  it('nộp lần đầu 23:30 giờ VN ngày hạn vẫn là đúng hạn', () => {
    const r = assistantOutcome(
      task({ firstSubmittedAt: new Date('2026-06-10T16:30:00Z') }),
      today,
    );
    expect(r.current.result).toBe('ON_TIME');
  });

  it('nộp 00:30 giờ VN ngày hôm sau là trễ 1 ngày', () => {
    const r = assistantOutcome(
      task({ firstSubmittedAt: new Date('2026-06-10T17:30:00Z') }),
      today,
    );
    expect(r.current).toEqual({ result: 'LATE', days: 1 });
  });

  it('chờ khách đã xác nhận cộng vào hạn nội bộ; vẫn gắn nhãn trễ do khách', () => {
    const r = assistantOutcome(
      task({
        firstSubmittedAt: new Date('2026-06-12T03:00:00Z'),
        waits: [
          {
            startedAt: new Date('2026-06-05T02:00:00Z'),
            endedAt: new Date('2026-06-08T02:00:00Z'),
          },
        ],
      }),
      today,
    );
    expect(r.waitDays).toBe(3);
    expect(r.current.result).toBe('ON_TIME');
    expect(r.clientDelay).toBe(true);
    expect(r.statutoryLate).toBe(false);
  });

  it('hạn pháp lý không cộng ngày chờ khách và tính trễ hạn pháp lý', () => {
    const r = assistantOutcome(
      task({
        isStatutory: true,
        firstSubmittedAt: new Date('2026-06-12T03:00:00Z'),
        waits: [
          {
            startedAt: new Date('2026-06-05T02:00:00Z'),
            endedAt: new Date('2026-06-08T02:00:00Z'),
          },
        ],
      }),
      today,
    );
    expect(r.current).toEqual({ result: 'LATE', days: 2 });
    expect(r.statutoryLate).toBe(true);
  });

  it('đánh giá theo cả hạn gốc', () => {
    const r = assistantOutcome(
      task({
        dueDate: d('2026-06-15'),
        firstSubmittedAt: new Date('2026-06-13T03:00:00Z'),
      }),
      today,
    );
    expect(r.current.result).toBe('ON_TIME');
    expect(r.original).toEqual({ result: 'LATE', days: 3 });
  });

  it('việc không cần soát xét dùng lúc được chấp nhận / hoàn thành', () => {
    const r = assistantOutcome(
      task({
        reviewLevels: 0,
        completedAt: new Date('2026-06-09T03:00:00Z'),
      }),
      today,
    );
    expect(r.milestone).toEqual(new Date('2026-06-09T03:00:00Z'));
    expect(r.current.result).toBe('ON_TIME');
  });

  it('việc chuyển đổi thiếu mốc không được tính', () => {
    const r = assistantOutcome(
      task({ legacy: true, completedAt: new Date('2026-06-09T03:00:00Z') }),
      today,
    );
    expect(r.counted).toBe(false);
  });

  it('chưa nộp, quá hạn → OVERDUE', () => {
    expect(assistantOutcome(task(), today).current).toEqual({
      result: 'OVERDUE',
      days: 20,
    });
  });

  it('khoảng chờ chồng nhau chỉ tính một lần; đang chờ tính tới hôm nay', () => {
    expect(
      clientWaitDays(
        [
          {
            startedAt: new Date('2026-06-01T02:00:00Z'),
            endedAt: new Date('2026-06-04T02:00:00Z'),
          },
          {
            startedAt: new Date('2026-06-03T02:00:00Z'),
            endedAt: new Date('2026-06-05T02:00:00Z'),
          },
        ],
        today,
      ),
    ).toBe(4);
    expect(
      clientWaitDays(
        [{ startedAt: new Date('2026-06-28T02:00:00Z'), endedAt: null }],
        today,
      ),
    ).toBe(2);
  });

  it('tỷ lệ đúng hạn bỏ việc chưa tới hạn khỏi mẫu số', () => {
    expect(
      onTimeRate([
        { result: 'ON_TIME', days: 0 },
        { result: 'LATE', days: 1 },
        { result: 'PENDING', days: 9 },
      ]),
    ).toBe(50);
    expect(onTimeRate([{ result: 'PENDING', days: 9 }])).toBeNull();
  });
});

const ptask = (patch: Partial<PeriodTask> = {}): PeriodTask => ({
  dueDate: d('2026-06-10'),
  originalDueDate: d('2026-06-10'),
  isStatutory: false,
  status: 'COMPLETED',
  acceptedAt: null,
  completedAt: new Date('2026-06-09T03:00:00Z'),
  extensions: 0,
  waits: [],
  ...patch,
});

describe('capability rules — kỳ dịch vụ', () => {
  it('hạn = hạn muộn nhất; đạt lúc việc cuối cùng đạt', () => {
    const r = periodOutcome(
      [
        ptask(),
        ptask({
          dueDate: d('2026-06-20'),
          originalDueDate: d('2026-06-15'),
          acceptedAt: new Date('2026-06-18T03:00:00Z'),
          extensions: 1,
        }),
      ],
      today,
    );
    expect(r.due).toEqual(d('2026-06-20'));
    expect(r.reachedAt).toEqual(new Date('2026-06-18T03:00:00Z'));
    expect(r.current.result).toBe('ON_TIME');
    expect(r.originalOutcome).toEqual({ result: 'LATE', days: 3 });
    expect(r.extended).toBe(true);
  });

  it('còn việc chưa xong → chưa đạt, quá hạn', () => {
    const r = periodOutcome(
      [ptask(), ptask({ status: 'IN_PROGRESS', completedAt: null })],
      today,
    );
    expect(r.reachedAt).toBeNull();
    expect(r.current.result).toBe('OVERDUE');
  });

  it('có việc hạn pháp lý thì không cộng ngày chờ khách', () => {
    const waits = [
      {
        startedAt: new Date('2026-06-01T02:00:00Z'),
        endedAt: new Date('2026-06-05T02:00:00Z'),
      },
    ];
    const late = new Date('2026-06-12T03:00:00Z');
    const normal = periodOutcome([ptask({ completedAt: late, waits })], today);
    const statutory = periodOutcome(
      [ptask({ completedAt: late, waits, isStatutory: true })],
      today,
    );
    expect(normal.current.result).toBe('ON_TIME');
    expect(statutory.current).toEqual({ result: 'LATE', days: 2 });
    expect(statutory.statutoryLate).toBe(true);
  });
});

describe('capability rules — người giữ vai (G1)', () => {
  const spans = [
    {
      role: 'LEAD',
      userId: 'old',
      fromAt: new Date('2026-01-01T00:00:00Z'),
      toAt: new Date('2026-06-05T03:00:00Z'),
    },
    {
      role: 'LEAD',
      userId: 'new',
      fromAt: new Date('2026-06-05T03:00:00Z'),
      toAt: null,
    },
    {
      role: 'MANAGER',
      userId: 'mgr',
      fromAt: new Date('2026-01-01T00:00:00Z'),
      toAt: null,
    },
  ];

  it('đổi trưởng nhóm giữa kỳ: kỳ gán cho người giữ vai lúc hạn đến', () => {
    const at = momentOf(d('2026-06-10'), null, new Date('2026-07-01'));
    expect(holderAt(spans, 'LEAD', at)).toEqual(['new']);
    const early = momentOf(
      d('2026-06-10'),
      new Date('2026-06-04T03:00:00Z'),
      new Date('2026-07-01'),
    );
    expect(holderAt(spans, 'LEAD', early)).toEqual(['old']);
    expect(holderAt(spans, 'MANAGER', at)).toEqual(['mgr']);
  });

  it('thời điểm = cuối ngày hạn giờ VN', () => {
    expect(momentOf(d('2026-06-10'), null, new Date('2026-07-01'))).toEqual(
      new Date('2026-06-10T16:59:59.999Z'),
    );
  });
});
