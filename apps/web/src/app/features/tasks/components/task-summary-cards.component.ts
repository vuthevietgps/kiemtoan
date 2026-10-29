import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { TaskSummary } from '../data-access/tasks.api';

/** Ô đếm phía trên trang công việc; bấm vào để áp bộ lọc tương ứng. */
export type SummaryCardKey =
  'today' | 'remaining' | 'overdue' | 'review' | 'waiting' | 'missing' | 'done';

interface Card {
  key: SummaryCardKey;
  label: string;
  icon: string;
  tone: string;
  value: number;
}

@Component({
  selector: 'app-task-summary-cards',
  imports: [NzIconModule],
  template: `
    <div class="cards">
      @for (card of cards(); track card.key) {
        <button
          type="button"
          class="card"
          [class.active]="active() === card.key"
          [attr.data-tone]="card.tone"
          (click)="pick.emit(card.key)"
        >
          <nz-icon [nzType]="card.icon" class="icon" />
          <span class="value">{{ card.value }}</span>
          <span class="label">{{ card.label }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .card {
      display: grid;
      grid-template-columns: auto 1fr;
      grid-template-rows: auto auto;
      column-gap: 12px;
      align-items: center;
      text-align: left;
      padding: 14px 16px;
      border-radius: 10px;
      border: 2px solid transparent;
      background: #fff;
      cursor: pointer;
      font: inherit;
    }
    .card:hover {
      border-color: #d6e4ff;
    }
    .card.active {
      border-color: #1677ff;
    }
    .icon {
      grid-row: span 2;
      font-size: 22px;
      padding: 10px;
      border-radius: 8px;
    }
    .value {
      font-size: 22px;
      font-weight: 600;
      color: #0f2a4a;
      line-height: 1.2;
    }
    .label {
      color: #6b7280;
      font-size: 13px;
    }
    [data-tone='blue'] .icon {
      background: #e6f4ff;
      color: #1677ff;
    }
    [data-tone='orange'] .icon {
      background: #fff7e6;
      color: #d46b08;
    }
    [data-tone='red'] .icon {
      background: #fff1f0;
      color: #cf1322;
    }
    [data-tone='purple'] .icon {
      background: #f9f0ff;
      color: #722ed1;
    }
    [data-tone='green'] .icon {
      background: #f6ffed;
      color: #389e0d;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskSummaryCardsComponent {
  readonly summary = input<TaskSummary | null>(null);
  readonly active = input<SummaryCardKey | null>(null);
  readonly pick = output<SummaryCardKey>();

  protected readonly cards = computed<Card[]>(() => {
    const s = this.summary();
    return [
      {
        key: 'today',
        label: 'Cần làm hôm nay',
        icon: 'clock-circle',
        tone: 'blue',
        value: s?.dueToday ?? 0,
      },
      {
        key: 'remaining',
        label: 'Còn phải làm',
        icon: 'unordered-list',
        tone: 'orange',
        value: s?.remaining ?? 0,
      },
      { key: 'overdue', label: 'Quá hạn', icon: 'warning', tone: 'red', value: s?.overdue ?? 0 },
      // 05-E: số chờ soát xét / chờ khách lấy từ trạng thái mới.
      {
        key: 'review',
        label: 'Chờ kiểm tra',
        icon: 'safety-certificate',
        tone: 'purple',
        value: s?.inReview ?? 0,
      },
      {
        key: 'waiting',
        label: 'Chờ khách hàng',
        icon: 'history',
        tone: 'orange',
        value: s?.waitingClient ?? 0,
      },
      {
        key: 'missing',
        label: 'Thiếu bằng chứng',
        icon: 'paper-clip',
        tone: 'purple',
        value: s?.missingEvidence ?? 0,
      },
      {
        key: 'done',
        label: 'Hoàn thành tháng này',
        icon: 'check-circle',
        tone: 'green',
        value: s?.doneThisMonth ?? 0,
      },
    ];
  });
}
