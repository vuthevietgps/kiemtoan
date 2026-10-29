import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { toDateParam } from '../../dashboard/data-access/format';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { CanDirective } from '../../../shared/directives/can.directive';
import { errorMessage } from '../../../core/api/api';
import { ACCOUNT_TEXT } from '../../../core/auth/account.text';
import { ACTION_LABELS, AuditLogApi, ENTITY_LABELS } from '../data-access/audit-log.api';

@Component({
  selector: 'app-audit-log-page',
  imports: [
    DatePipe,
    FormsModule,
    NzDatePickerModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    NzButtonModule, CanDirective,
  ],
  templateUrl: './audit-log.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogPage {
  protected readonly text = ACCOUNT_TEXT;
  private readonly api = inject(AuditLogApi);
  private readonly message = inject(NzMessageService);
  protected readonly exporting = signal(false);

  protected readonly actions = Object.entries(ACTION_LABELS).map(([value, a]) => ({
    value,
    label: a.label,
  }));

  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly userId = signal<string | null>(null);
  protected readonly entity = signal<string | null>(null);
  protected readonly action = signal<string | null>(null);
  protected readonly range = signal<Date[] | null>(null);

  protected readonly logs = rxResource({
    params: () => {
      const range = this.range();
      return {
        page: this.page(),
        pageSize: this.pageSize(),
        userId: this.userId(),
        entity: this.entity(),
        action: this.action(),
        from: range?.[0] ? toDateParam(range[0]) : undefined,
        to: range?.[1] ? toDateParam(range[1]) : undefined,
      };
    },
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly users = rxResource({ stream: () => this.api.users() });
  protected readonly entities = rxResource({ stream: () => this.api.entities() });

  /** Đổi bộ lọc thì quay về trang 1. */
  protected setFilter<T>(target: { set: (v: T) => void }, value: T): void {
    this.page.set(1);
    target.set(value);
  }

  protected actionOf(code: string) {
    return ACTION_LABELS[code] ?? { label: code, color: 'default' };
  }

  protected entityLabel(entity: string): string {
    return ENTITY_LABELS[entity] ?? entity;
  }
  protected export(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    const range = this.range();
    this.api.export({ page: 1, pageSize: 100, userId: this.userId(), entity: this.entity(), action: this.action(), from: range?.[0] ? toDateParam(range[0]) : undefined, to: range?.[1] ? toDateParam(range[1]) : undefined }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'nhat-ky-hoat-dong.xlsx'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000); this.exporting.set(false);
      },
      error: (error: unknown) => { this.exporting.set(false); this.message.error(errorMessage(error)); },
    });
  }
}
