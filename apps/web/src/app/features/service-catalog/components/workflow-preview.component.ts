import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { WorkflowPreview } from '../data-access/workflows.api';
import { WORKFLOW_TEXT } from '../workflow.text';

/** Lịch dự kiến của phiên bản (chỉ hiển thị). */
@Component({
  selector: 'app-workflow-preview',
  imports: [DatePipe, NzTableModule],
  template: `
    @if (preview().totalWorkingDays !== null) {
      <p>
        <strong>{{ text.totalDays }}: {{ preview().totalWorkingDays }}</strong> {{ text.totalHint }}
      </p>
    }
    <nz-table [nzData]="preview().steps" [nzShowPagination]="false" [nzScroll]="{ x: '560px' }" nzSize="small">
      <thead>
        <tr>
          <th>{{ text.stepName }}</th>
          <th nzWidth="120px">{{ text.from }}</th>
          <th nzWidth="140px">{{ text.to }}</th>
        </tr>
      </thead>
      <tbody>
        @for (s of preview().steps; track s.key) {
          <tr>
            <td>{{ s.key }} — {{ s.name }}</td>
            <!-- Ngày dạng YYYY-MM-DD được hiểu là ngày địa phương: không đổi múi giờ. -->
            <td>{{ s.start ? (s.start | date: 'dd/MM/yyyy') : text.none }}</td>
            <td>{{ s.end | date: 'dd/MM/yyyy' }}</td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowPreviewComponent {
  readonly preview = input.required<WorkflowPreview>();
  protected readonly text = WORKFLOW_TEXT;
}
