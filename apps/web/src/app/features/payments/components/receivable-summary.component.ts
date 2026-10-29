import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import type { Receivables } from '../data-access/payments.api';
import { AGING_ORDER } from '../data-access/receivables.store';
import {
  RECEIVABLE_AGING_COLORS,
  RECEIVABLE_AGING_LABELS,
  RECEIVABLES_TEXT,
} from '../payments.text';

/** Ô đếm công nợ (phải thu, quá hạn, đến hạn 7 ngày, chờ duyệt) và thanh tuổi nợ J12. */
@Component({
  selector: 'app-receivable-summary',
  imports: [VndPipe],
  template: `
    @if (summary(); as s) {
      <div class="cards">
        <div class="card">
          <span>{{ text.cardRemaining }}</span><b>{{ s.remaining | vnd }}</b>
        </div>
        <div class="card danger">
          <span>{{ text.cardOverdue }}</span><b>{{ s.overdueAmount | vnd }}</b>
        </div>
        <div class="card warn">
          <span>{{ text.cardUpcoming }}</span><b>{{ s.upcomingAmount | vnd }}</b>
        </div>
        <div class="card muted">
          <span>{{ text.cardPending }}</span><b>{{ s.pendingAmount | vnd }}</b>
        </div>
      </div>
      <div class="aging">
        <div class="aging-title">{{ text.agingTitle }}</div>
        <div class="bar">
          @for (seg of segments(); track seg.key) {
            @if (seg.percent > 0) {
              <span [style.width.%]="seg.percent" [style.background]="seg.color"></span>
            }
          }
        </div>
        <div class="legend">
          @for (seg of segments(); track seg.key) {
            <div class="item">
              <i [style.background]="seg.color"></i>
              <span>{{ seg.label }}</span>
              <b>{{ seg.amount | vnd }}</b>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border: 1px solid #f0f0f0;
      border-left: 4px solid #1677ff;
      border-radius: 6px;
      background: #fff;
      min-width: 0;
      span {
        color: rgba(0, 0, 0, 0.55);
      }
      b {
        font-size: 16px;
        word-break: break-word;
      }
    }
    .card.danger {
      border-left-color: #cf1322;
    }
    .card.warn {
      border-left-color: #fa8c16;
    }
    .card.muted {
      border-left-color: #8c8c8c;
    }
    .aging {
      margin-bottom: 12px;
    }
    .aging-title {
      margin-bottom: 6px;
      font-weight: 500;
    }
    .bar {
      display: flex;
      height: 10px;
      overflow: hidden;
      border-radius: 5px;
      background: #f0f0f0;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      margin-top: 6px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 6px;
      i {
        width: 10px;
        height: 10px;
        border-radius: 2px;
      }
      span {
        color: rgba(0, 0, 0, 0.55);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceivableSummaryComponent {
  readonly summary = input<Receivables['summary'] | null>(null);

  protected readonly text = RECEIVABLES_TEXT;
  protected readonly segments = computed(() => {
    const s = this.summary();
    if (!s) return [];
    const total = AGING_ORDER.reduce((acc, k) => acc + Number(s.aging[k]), 0);
    return AGING_ORDER.map((key) => ({
      key,
      label: RECEIVABLE_AGING_LABELS[key],
      color: RECEIVABLE_AGING_COLORS[key],
      amount: s.aging[key],
      percent: total > 0 ? (Number(s.aging[key]) / total) * 100 : 0,
    }));
  });
}
