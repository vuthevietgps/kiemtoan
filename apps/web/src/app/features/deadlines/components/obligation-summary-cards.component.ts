import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ObligationSummary } from '../data-access/obligations.api';
import { DEADLINES_TEXT, ObligationDisplayStatus } from '../deadlines.text';

interface Card {
  key: keyof ObligationSummary;
  status: ObligationDisplayStatus;
  label: string;
  tone: string;
}

const CARDS: Card[] = [
  { key: 'notDue', status: 'NOT_DUE', label: DEADLINES_TEXT.cardNotDue, tone: 'neutral' },
  { key: 'preparing', status: 'PREPARING', label: DEADLINES_TEXT.cardPreparing, tone: 'blue' },
  { key: 'overdue', status: 'OVERDUE', label: DEADLINES_TEXT.cardOverdue, tone: 'red' },
  { key: 'filedThisMonth', status: 'FILED', label: DEADLINES_TEXT.cardFiled, tone: 'green' },
];

/** Ô đếm Lịch báo cáo (PDF 4.3); bấm ô lọc bảng theo trạng thái, bấm lại bỏ lọc. */
@Component({
  selector: 'app-obligation-summary-cards',
  templateUrl: './obligation-summary-cards.component.html',
  styleUrl: './obligation-summary-cards.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObligationSummaryCardsComponent {
  readonly summary = input.required<ObligationSummary>();
  readonly active = input<ObligationDisplayStatus | null>(null);
  readonly pick = output<ObligationDisplayStatus | null>();
  protected readonly cards = CARDS;
}
