import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../../core/api/api';
import { ServiceType } from '../../../service-catalog/data-access/service-catalog.api';
import {
  AUDIT_TEXT,
  DEADLINE_KIND_LABELS,
  DEADLINE_RESULT_LABELS,
  ROLE_LABELS,
} from '../../audit-tracking.text';
import {
  AuditTrackingApi,
  PeopleQuery,
  PeopleRow,
  PersonDetail,
} from '../../data-access/audit-tracking.api';
import { toDateString } from '../../form-utils';

/** Màu theo ngưỡng mặc định của khung đánh giá (G8): ≥ 95% xanh, 85–95% vàng, < 85% đỏ. */
export function rateColor(rate: number | null): string {
  if (rate === null) return 'default';
  return rate >= 95 ? 'green' : rate >= 85 ? 'gold' : 'red';
}

/** Tab Theo nhân sự (04-F2/F3): đúng hạn hồ sơ kiểm toán theo người chịu trách nhiệm (F10, F11). */
@Component({
  selector: 'app-audit-people-panel',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './audit-people.panel.html',
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
      align-items: center;
    }
    .filters nz-select {
      min-width: 160px;
    }
    .muted {
      color: rgba(0, 0, 0, 0.55);
      font-size: 12px;
    }
    tr.clickable {
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPeoplePanel implements OnInit {
  readonly services = input<ServiceType[]>([]);

  private readonly api = inject(AuditTrackingApi);
  private readonly message = inject(NzMessageService);
  protected readonly text = AUDIT_TEXT;
  protected readonly kindLabels = DEADLINE_KIND_LABELS;
  protected readonly resultLabels = DEADLINE_RESULT_LABELS;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly rateColor = rateColor;
  protected readonly roles = ['MANAGER', 'LEAD', 'SIGNER1'] as const;
  protected readonly kinds = Object.keys(
    DEADLINE_KIND_LABELS,
  ) as (keyof typeof DEADLINE_KIND_LABELS)[];

  protected readonly items = signal<PeopleRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly detail = signal<PersonDetail | null>(null);
  protected from: Date | null = new Date(new Date().getFullYear(), 0, 1);
  protected to: Date | null = new Date(new Date().getFullYear(), 11, 31);
  protected role: PeopleQuery['role'] = null;
  protected kind: PeopleQuery['kind'] = null;
  protected serviceTypeId: string | null = null;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.people(this.query()).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.message.error(errorMessage(err));
      },
    });
  }

  protected open(row: PeopleRow): void {
    this.api.person(row.user.id, this.query()).subscribe({
      next: (res) => this.detail.set(res),
      error: (err: unknown) => this.message.error(errorMessage(err)),
    });
  }

  protected roleNames(roles: string[]): string {
    return roles.map((r) => this.roleLabels[r] ?? r).join(', ');
  }

  private query(): PeopleQuery {
    return {
      from: toDateString(this.from),
      to: toDateString(this.to),
      role: this.role,
      kind: this.kind,
      serviceTypeId: this.serviceTypeId,
    };
  }
}
