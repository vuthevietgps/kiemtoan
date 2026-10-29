import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { errorMessage } from '../../../core/api/api';
import { CustomerOption, TasksApi, UserOption } from '../data-access/tasks.api';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Tạo việc phát sinh (ngoài công việc tự sinh từ hợp đồng). */
@Component({
  selector: 'app-task-create-modal',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzDatePickerModule,
    NzCheckboxModule,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      nzTitle="Thêm việc phát sinh"
      nzOkText="Tạo việc"
      nzCancelText="Huỷ"
      [nzOkLoading]="saving()"
      (nzOnOk)="submit()"
      (nzOnCancel)="visible.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired>Khách hàng</nz-form-label>
            <nz-form-control nzErrorTip="Vui lòng chọn khách hàng">
              <nz-select formControlName="customerId" nzShowSearch nzPlaceHolder="Chọn khách hàng">
                @for (c of customers(); track c.id) {
                  <nz-option [nzValue]="c.id" [nzLabel]="c.name + ' — ' + c.taxCode" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Tên công việc</nz-form-label>
            <nz-form-control nzErrorTip="Vui lòng nhập tên công việc">
              <input nz-input formControlName="title" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Hạn hoàn thành</nz-form-label>
            <nz-form-control nzErrorTip="Vui lòng chọn hạn">
              <nz-date-picker formControlName="dueDate" nzFormat="dd/MM/yyyy" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Người làm</nz-form-label>
            <nz-form-control>
              <nz-select
                formControlName="assigneeId"
                nzShowSearch
                nzAllowClear
                nzPlaceHolder="Chưa giao"
              >
                @for (u of users(); track u.id) {
                  <nz-option [nzValue]="u.id" [nzLabel]="u.fullName" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-control>
              <label nz-checkbox formControlName="requiresEvidence"
                >Bắt buộc có file bằng chứng</label
              >
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Ghi chú</nz-form-label>
            <nz-form-control>
              <textarea nz-input rows="2" formControlName="note"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCreateModalComponent {
  private readonly api = inject(TasksApi);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly visible = model(false);
  readonly customers = input<CustomerOption[]>([]);
  readonly users = input<UserOption[]>([]);
  readonly created = output<void>();

  protected readonly saving = signal(false);
  protected readonly form = this.fb.group({
    customerId: this.fb.control('', Validators.required),
    title: this.fb.control('', [Validators.required, Validators.minLength(2)]),
    dueDate: this.fb.control<Date | null>(null, Validators.required),
    assigneeId: this.fb.control<string | null>(null),
    requiresEvidence: this.fb.control(true),
    note: this.fb.control(''),
  });

  protected submit(): void {
    if (this.form.invalid) {
      for (const control of Object.values(this.form.controls)) {
        control.markAsDirty();
        control.updateValueAndValidity();
      }
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .create({
        customerId: v.customerId,
        title: v.title.trim(),
        dueDate: toIsoDate(v.dueDate as Date),
        assigneeId: v.assigneeId ?? undefined,
        requiresEvidence: v.requiresEvidence,
        note: v.note.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.success('Đã tạo công việc');
          this.form.reset();
          this.visible.set(false);
          this.created.emit();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.message.error(errorMessage(err));
        },
      });
  }
}
