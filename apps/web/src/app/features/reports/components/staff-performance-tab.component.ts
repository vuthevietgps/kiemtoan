import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { errorMessage } from '../../../core/api/api';
import { Role, ROLE_LABELS } from '../../../core/auth/auth.service';
import { CanDirective } from '../../../shared/directives/can.directive';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { ReportsApi } from '../data-access/reports.api';

@Component({
  selector: 'app-staff-performance-tab',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzIconModule,
    NzProgressModule,
    NzTableModule,
    CanDirective,
    VndPipe,
  ],
  template: `
    <div class="filters">
      <span class="text-muted">Việc hoàn thành trong kỳ, doanh thu hợp đồng bắt đầu trong kỳ.</span>
      <a nz-button *appCan="'reports:export'" [href]="csvUrl()" download>
        <nz-icon nzType="download" /> Xuất CSV
      </a>
    </div>
    @if (report.error(); as err) {
      <nz-alert nzType="error" [nzMessage]="message(err)" nzShowIcon />
    }
    <nz-table
      #t
      [nzData]="report.value()?.rows ?? []"
      [nzLoading]="report.isLoading()"
      [nzPageSize]="20"
      nzSize="small"
      [nzScroll]="{ x: '880px' }"
      nzNoResult="Không có nhân viên"
    >
      <thead>
        <tr>
          <th>Nhân viên</th>
          <th>Nhóm</th>
          <th class="text-right">Việc hoàn thành</th>
          <th class="text-right">Trễ hạn</th>
          <th nzWidth="180px">Tỷ lệ đúng hạn</th>
          <th class="text-right">KH phụ trách</th>
          <th *appCan="'finance:view'" class="text-right">Doanh thu HĐ phụ trách</th>
        </tr>
      </thead>
      <tbody>
        @for (r of t.data; track r.userId) {
          <tr>
            <td>
              {{ r.fullName }}
              <div class="text-muted small">{{ roleLabel(r.role) }}</div>
            </td>
            <td>{{ r.teamName ?? '—' }}</td>
            <td class="text-right">{{ r.tasksDone }}</td>
            <td class="text-right">{{ r.late }}</td>
            <td>
              @if (r.onTimeRate === null) {
                <span class="text-muted">—</span>
              } @else {
                <nz-progress [nzPercent]="r.onTimeRate" nzSize="small" />
              }
            </td>
            <td class="text-right">{{ r.customers }}</td>
            <td *appCan="'finance:view'" class="text-right">{{ r.revenue | vnd }}</td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  styles: `
    .filters { justify-content: space-between; align-items: center; }
    .small { font-size: 12px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffPerformanceTabComponent {
  private readonly api = inject(ReportsApi);
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  protected readonly message = errorMessage;

  protected readonly report = rxResource({
    params: () => ({ from: this.from(), to: this.to() }),
    stream: ({ params }) => this.api.staffPerformance(params),
  });

  protected readonly csvUrl = computed(() =>
    this.api.csvUrl('staff-performance', { from: this.from(), to: this.to() }),
  );

  protected roleLabel(role: string): string {
    return ROLE_LABELS[role as Role] ?? role;
  }
}
