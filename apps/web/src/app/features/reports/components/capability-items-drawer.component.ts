import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { of } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { DEADLINE_KIND_LABELS, DEADLINE_RESULT_LABELS } from '../../contracts/audit-tracking.text';
import { CapabilityApi, CapabilityQuery, Person } from '../data-access/capability.api';
import { ASSISTANT_CELL_LABELS, AssistantCell, filterTasks } from '../data-access/capability-tones';
import { vnDate } from '../data-access/print-report';

const vnMoment = (at: string | null) =>
  at ? new Date(at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';

/**
 * Danh sách tái lập con số của một người (10-E, G "Hiển thị"): việc của trợ lý (lọc theo ô đã bấm), kỳ
 * dịch vụ kế toán, hạn hồ sơ kiểm toán, lượt soát xét.
 */
@Component({
  selector: 'app-capability-items-drawer',
  imports: [RouterLink, NzAlertModule, NzDrawerModule, NzTableModule, NzTagModule],
  templateUrl: './capability-items-drawer.component.html',
  styles: `
    h4 {
      margin: 16px 0 8px;
      color: #0f2a4a;
    }
    .muted {
      color: #6b7280;
      font-size: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapabilityItemsDrawerComponent {
  private readonly api = inject(CapabilityApi);
  readonly person = input<Person | null>(null);
  readonly query = input.required<CapabilityQuery>();
  readonly cell = input<AssistantCell | null>(null);
  readonly closed = output<void>();
  readonly clearCell = output<void>();

  protected readonly message = errorMessage;
  protected readonly date = vnDate;
  protected readonly moment = vnMoment;
  protected readonly results = DEADLINE_RESULT_LABELS;
  protected readonly kinds = DEADLINE_KIND_LABELS;
  protected readonly cellLabels = ASSISTANT_CELL_LABELS;
  protected readonly width = computed(() =>
    Math.min(960, typeof window === 'undefined' ? 960 : window.innerWidth),
  );

  protected readonly items = rxResource({
    params: () => ({ person: this.person(), query: this.query() }),
    stream: ({ params }) =>
      params.person ? this.api.items(params.person.id, params.query) : of(null),
  });

  protected readonly tasks = computed(() =>
    filterTasks(this.items.value()?.tasks ?? [], this.cell()),
  );
}
