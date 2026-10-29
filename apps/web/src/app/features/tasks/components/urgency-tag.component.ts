import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Urgency, URGENCY_COLORS, URGENCY_LABELS } from '../task-labels';

/** Nhãn mức gấp tự động (06, I11); "Bình thường" và việc đã xong không hiện nhãn. */
@Component({
  selector: 'app-urgency-tag',
  imports: [NzTagModule],
  template: `
    @if (urgency(); as u) {
      @if (u !== 'NORMAL') {
        <nz-tag [nzColor]="colors[u]">{{ labels[u] }}</nz-tag>
      }
    }
  `,
  styles: `:host { display: inline-block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrgencyTagComponent {
  readonly urgency = input<Urgency | null | undefined>(null);
  protected readonly labels = URGENCY_LABELS;
  protected readonly colors = URGENCY_COLORS;
}
