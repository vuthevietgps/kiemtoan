import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { CanDirective } from '../../../shared/directives/can.directive';
import { saveFile } from '../../deadlines/save-file';
import { PrintableReport, printReport } from '../data-access/print-report';
import { ReportContext } from '../data-access/report-context';
import { FilterParams, ReportKey } from '../data-access/saved-filters.api';
import { SavedFiltersComponent } from './saved-filters.component';

/**
 * Thanh công cụ chung của báo cáo (10, M10): ghi chú cách tính, "Xuất Excel" (quyền `reports:export`) và
 * "In / PDF" (bản in của trình duyệt). Báo cáo đưa vào hàm tạo file và hàm dựng bản in.
 */
@Component({
  selector: 'app-report-toolbar',
  imports: [NzButtonModule, NzIconModule, CanDirective, SavedFiltersComponent],
  template: `
    @if (context && report(); as key) {
      <app-saved-filters
        [report]="key"
        [params]="filterParams()"
        (applied)="filterApplied.emit($event)"
      />
    }
    <div class="toolbar">
      <span class="note">{{ note() }}</span>
      <div class="actions">
        <button nz-button type="button" *appCan="'reports:export'" (click)="excel()">
          <nz-icon nzType="download" /> Xuất Excel
        </button>
        <button nz-button type="button" [disabled]="!printable()" (click)="print()">
          <nz-icon nzType="file-text" /> In / PDF
        </button>
      </div>
    </div>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .note {
      color: #6b7280;
      font-size: 13px;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportToolbarComponent {
  private readonly message = inject(NzMessageService);
  private readonly auth = inject(AuthService);
  protected readonly context = inject(ReportContext, { optional: true });

  /** 10-F: báo cáo lưu được bộ lọc, tham số riêng của báo cáo và sự kiện mở lại bộ lọc. */
  readonly report = input<ReportKey | null>(null);
  readonly filterParams = input<FilterParams>({});
  readonly filterApplied = output<Record<string, string>>();
  readonly note = input('');
  readonly fileName = input.required<string>();
  readonly download = input.required<() => Observable<Blob>>();
  /** Bản in (không có số liệu thì null). Người in điền ở đây. */
  readonly printable = input<Omit<PrintableReport, 'printedBy'> | null>(null);
  readonly printed = output<void>();

  protected async excel(): Promise<void> {
    try {
      saveFile(await firstValueFrom(this.download()()), this.fileName());
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }

  protected print(): void {
    const report = this.printable();
    if (!report) return;
    const ok = printReport({ ...report, printedBy: this.auth.user()?.fullName ?? '' });
    if (!ok)
      this.message.warning('Trình duyệt đã chặn cửa sổ in — cho phép cửa sổ bật lên rồi thử lại');
    else this.printed.emit();
  }
}
