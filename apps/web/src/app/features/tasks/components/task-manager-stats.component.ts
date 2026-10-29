import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { CustomerTaskStats, WorkloadRow } from '../data-access/tasks.api';

/** Bảng thống kê cho quản lý: theo khách hàng hoặc khối lượng theo nhân viên. */
@Component({
  selector: 'app-task-manager-stats',
  imports: [NzTableModule],
  template: `
    @if (mode() === 'customers') {
      <nz-table
        #ct
        [nzData]="customers()"
        [nzLoading]="loading()"
        [nzScroll]="{ x: '720px' }"
        nzSize="middle"
        [nzPageSize]="20"
      >
        <thead>
          <tr>
            <th>Khách hàng</th>
            <th class="num">Chưa làm</th>
            <th class="num">Đang làm</th>
            <th class="num">Hoàn thành</th>
            <th class="num">Quá hạn</th>
            <th class="num">Thiếu bằng chứng</th>
          </tr>
        </thead>
        <tbody>
          @for (row of ct.data; track row.customerId) {
            <tr>
              <td>
                <a (click)="pickCustomer.emit(row.customerId)">{{ row.customerName }}</a>
              </td>
              <td class="num">{{ row.todo }}</td>
              <td class="num">{{ row.inProgress }}</td>
              <td class="num">{{ row.done }}</td>
              <td class="num" [class.bad]="row.overdue > 0">{{ row.overdue }}</td>
              <td class="num" [class.warn]="row.missingEvidence > 0">{{ row.missingEvidence }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    } @else {
      <nz-table
        #wt
        [nzData]="workload()"
        [nzLoading]="loading()"
        [nzScroll]="{ x: '560px' }"
        nzSize="middle"
        [nzPageSize]="20"
      >
        <thead>
          <tr>
            <th>Nhân viên</th>
            <th class="num">Đang giữ (chưa xong)</th>
            <th class="num">Quá hạn</th>
            <th class="num">Hoàn thành tháng này</th>
          </tr>
        </thead>
        <tbody>
          @for (row of wt.data; track row.userId) {
            <tr>
              <td>
                <a (click)="pickAssignee.emit(row.userId)">{{ row.fullName }}</a>
              </td>
              <td class="num">{{ row.open }}</td>
              <td class="num" [class.bad]="row.overdue > 0">{{ row.overdue }}</td>
              <td class="num">{{ row.doneThisMonth }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
  styles: `
    .num {
      text-align: right;
    }
    .bad {
      color: #cf1322;
      font-weight: 600;
    }
    .warn {
      color: #d46b08;
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskManagerStatsComponent {
  readonly mode = input<'customers' | 'workload'>('customers');
  readonly customers = input<CustomerTaskStats[]>([]);
  readonly workload = input<WorkloadRow[]>([]);
  readonly loading = input(false);
  readonly pickCustomer = output<string>();
  readonly pickAssignee = output<string>();
}
