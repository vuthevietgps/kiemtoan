import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import type { Obligation } from '../data-access/obligations.api';
import {
  DEADLINES_TEXT,
  OBLIGATION_STATUS_COLORS,
  OBLIGATION_STATUS_LABELS,
} from '../deadlines.text';

/** Bảng lịch báo cáo; bấm dòng mở chi tiết. Dùng ở màn hình Lịch báo cáo và tab của KH. */
@Component({
  selector: 'app-obligation-table',
  imports: [DatePipe, NzTableModule, NzTagModule, NzTooltipModule],
  templateUrl: './obligation-table.component.html',
  styleUrl: './obligation-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObligationTableComponent {
  readonly items = input.required<Obligation[]>();
  readonly total = input(0);
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly loading = input(false);
  readonly showCustomer = input(true);
  readonly open = output<string>();
  readonly pageChange = output<number>();

  protected readonly text = DEADLINES_TEXT;
  protected readonly labels = OBLIGATION_STATUS_LABELS;
  protected readonly colors = OBLIGATION_STATUS_COLORS;
}
