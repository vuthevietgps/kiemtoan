import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { of } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { UsersApi } from '../../users/data-access/users.api';
import {
  AssistantRow,
  CapabilityApi,
  CapabilityDomain,
  CapabilityQuery,
  CapabilityRole,
  Person,
  TeamRow,
} from '../data-access/capability.api';
import {
  AssistantCell,
  onTimeTone,
  rateText,
  returnTone,
  statutoryTone,
} from '../data-access/capability-tones';
import { capabilityPrintable } from '../data-access/capability-print';
import { CapabilityItemsDrawerComponent } from './capability-items-drawer.component';
import { ReportToolbarComponent } from './report-toolbar.component';

export const CAPABILITY_ROLES: { value: CapabilityRole; label: string }[] = [
  { value: 'ASSISTANT', label: 'Trợ lý' },
  { value: 'LEAD', label: 'Trưởng nhóm' },
  { value: 'MANAGER', label: 'Manager' },
];
export const CAPABILITY_DOMAINS: { value: CapabilityDomain; label: string }[] = [
  { value: 'ALL', label: 'Kế toán + kiểm toán' },
  { value: 'ACCOUNTING', label: 'Kế toán dịch vụ' },
  { value: 'AUDIT', label: 'Kiểm toán' },
];

/**
 * Đánh giá năng lực (10-E, M9, khung G1–G10): tab Trợ lý / Trưởng nhóm / Manager, mảng kế toán / kiểm toán
 * (không cộng hai mảng thành một số), mỗi chỉ số một cột tô màu theo ngưỡng G8, bấm ô ra danh sách tái lập
 * con số. Phạm vi G9 do máy chủ lọc; không có số tiền.
 */
@Component({
  selector: 'app-capability-tab',
  imports: [
    FormsModule,
    NzAlertModule,
    NzRadioModule,
    NzSelectModule,
    NzTableModule,
    ReportToolbarComponent,
    CapabilityItemsDrawerComponent,
  ],
  templateUrl: './capability-tab.component.html',
  styleUrl: './capability-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapabilityTabComponent {
  private readonly api = inject(CapabilityApi);
  private readonly users = inject(UsersApi);
  private readonly auth = inject(AuthService);
  readonly from = input.required<string>();
  readonly to = input.required<string>();

  protected readonly roles = CAPABILITY_ROLES;
  protected readonly domains = CAPABILITY_DOMAINS;
  protected readonly message = errorMessage;
  protected readonly rate = rateText;
  protected readonly onTimeTone = onTimeTone;
  protected readonly returnTone = returnTone;
  protected readonly statutoryTone = statutoryTone;

  protected readonly role = signal<CapabilityRole>('ASSISTANT');
  protected readonly domain = signal<CapabilityDomain>('ALL');
  protected readonly teamId = signal<string | null>(null);
  protected readonly person = signal<Person | null>(null);
  protected readonly cell = signal<AssistantCell | null>(null);

  protected readonly query = computed((): CapabilityQuery => ({
    from: this.from(),
    to: this.to(),
    role: this.role(),
    domain: this.domain(),
    teamId: this.teamId(),
  }));
  protected readonly report = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.report(params),
  });
  /** Lọc nhóm chỉ cho người xem được danh sách nhóm (Giám đốc / KTT). */
  protected readonly teams = rxResource({
    params: () => this.auth.can('users:view'),
    stream: ({ params }) => (params ? this.users.teams() : of([])),
  });

  protected readonly assistantRows = computed(() =>
    this.report.value()?.role === 'ASSISTANT' ? (this.report.value()!.rows as AssistantRow[]) : [],
  );
  protected readonly teamRows = computed(() =>
    this.report.value()?.role === 'ASSISTANT'
      ? []
      : ((this.report.value()?.rows ?? []) as TeamRow[]),
  );
  protected readonly showAccounting = computed(() => this.domain() !== 'AUDIT');
  protected readonly showAudit = computed(() => this.domain() !== 'ACCOUNTING');
  protected readonly isLead = computed(() => this.report.value()?.role === 'LEAD');

  protected readonly download = () => this.api.exportFile(this.query());
  protected readonly printable = computed(() => {
    const r = this.report.value();
    return r ? capabilityPrintable(r) : null;
  });

  /** 10-F: mở lại bộ lọc đã lưu. */
  protected applyFilter(params: Record<string, string>): void {
    this.role.set((params['role'] as CapabilityRole) ?? 'ASSISTANT');
    this.domain.set((params['domain'] as CapabilityDomain) ?? 'ALL');
    this.teamId.set(params['teamId'] ?? null);
  }

  protected open(user: Person, cell: AssistantCell | null = null): void {
    this.cell.set(cell);
    this.person.set(user);
  }

  protected close(): void {
    this.person.set(null);
    this.cell.set(null);
  }
}
