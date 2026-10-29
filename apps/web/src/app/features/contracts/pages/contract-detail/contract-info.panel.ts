import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../../../core/api/api';
import { AuthService } from '../../../../core/auth/auth.service';
import { CONTRACT_STATUS_COLORS, CONTRACT_STATUS_LABELS } from '../../contract-labels';
import { LIFECYCLE_TEXT } from '../../contract-lifecycle.text';
import { BusinessInfoInput, ContractLifecycleApi } from '../../data-access/contract-lifecycle.api';
import { ContractDetail, ContractsApi, UserOption } from '../../data-access/contracts.api';
import { fromDateString, toDateString } from '../../form-utils';

/** Thông tin chung của HĐ và form sửa thông tin không ảnh hưởng tiền (E5, E6). */
@Component({
  selector: 'app-contract-info-panel',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTagModule,
  ],
  templateUrl: './contract-info.panel.html',
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 8px 16px;
    }
    nz-select,
    nz-date-picker {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractInfoPanel {
  readonly contract = input.required<ContractDetail>();
  readonly changed = output<void>();

  private readonly api = inject(ContractLifecycleApi);
  private readonly contractsApi = inject(ContractsApi);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);
  protected readonly text = LIFECYCLE_TEXT;
  protected readonly statusLabels = CONTRACT_STATUS_LABELS;
  protected readonly statusColors = CONTRACT_STATUS_COLORS;
  protected readonly canEdit = computed(
    () => this.auth.can('contracts:update') && this.contract().status !== 'CANCELLED',
  );
  protected readonly users = signal<UserOption[]>([]);
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly form = signal<BusinessInfoInput & { signed: Date | null }>({ signed: null });

  protected async open(): Promise<void> {
    const c = this.contract();
    this.form.set({
      ownerId: c.ownerId,
      salesOwnerId: c.salesOwnerId,
      referrerName: c.referrerName ?? '',
      referrerPhone: c.referrerPhone ?? '',
      referrerNote: c.referrerNote ?? '',
      note: c.note ?? '',
      signed: fromDateString(c.signedDate),
    });
    this.editing.set(true);
    if (!this.users().length) {
      try {
        const users = await firstValueFrom(this.contractsApi.userOptions());
        this.users.set(users.filter((u) => u.role !== 'ADMIN'));
      } catch (err) {
        this.message.error(errorMessage(err));
      }
    }
  }

  protected patch(patch: Partial<BusinessInfoInput & { signed: Date | null }>): void {
    this.form.update((current) => ({ ...current, ...patch }));
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const { signed, ...value } = this.form();
    const blank = (v: string | null | undefined) => (v ?? '').trim() || null;
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.api.updateBusinessInfo(this.contract().id, {
          ownerId: value.ownerId ?? null,
          salesOwnerId: value.salesOwnerId ?? null,
          referrerName: blank(value.referrerName),
          referrerPhone: blank(value.referrerPhone),
          referrerNote: blank(value.referrerNote),
          note: blank(value.note),
          signedDate: toDateString(signed),
        }),
      );
      this.message.success(this.text.saved);
      this.editing.set(false);
      this.changed.emit();
    } catch (err) {
      this.message.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
