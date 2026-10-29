import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { ServiceType } from '../../../service-catalog/data-access/service-catalog.api';
import { AMENDMENT_TEXT } from '../../contract-lifecycle.text';
import {
  Amendment,
  AmendmentInput,
  AmendmentLineInput,
} from '../../data-access/contract-lifecycle.api';
import { ContractServiceLine } from '../../data-access/contracts.api';
import { fromDateString, moneyFormatter, moneyParser, toDateString } from '../../form-utils';

type Mode = 'KEEP' | 'UPDATE' | 'REMOVE';
interface ExistingRow {
  lineId: string;
  mode: Mode;
  quantity: number;
  unitPrice: number;
}
interface NewRow {
  serviceTypeId: string | null;
  period: string;
  quantity: number;
  unitPrice: number;
}

/** Form phụ lục (04-D): mỗi dòng có sẵn chọn giữ/sửa/bỏ, thêm dòng mới; chỉ phát dữ liệu, không gọi API. */
@Component({
  selector: 'app-amendment-editor',
  imports: [
    FormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
  ],
  templateUrl: './amendment-editor.component.html',
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px 16px;
      margin-bottom: 12px;
    }
    nz-input-number,
    nz-select,
    nz-date-picker {
      width: 100%;
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 12px;
    }
    .error {
      color: #cf1322;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmendmentEditorComponent {
  readonly services = input.required<ContractServiceLine[]>();
  readonly serviceTypes = input<ServiceType[]>([]);
  readonly initial = input<Amendment | null>(null);
  readonly busy = input(false);
  readonly save = output<AmendmentInput>();
  readonly cancelled = output<void>();

  protected readonly text = AMENDMENT_TEXT;
  protected readonly moneyFormatter = moneyFormatter;
  protected readonly moneyParser = moneyParser;
  protected readonly modes: { value: Mode; label: string }[] = [
    { value: 'KEEP', label: AMENDMENT_TEXT.keep },
    { value: 'UPDATE', label: AMENDMENT_TEXT.edit },
    { value: 'REMOVE', label: AMENDMENT_TEXT.removeLine },
  ];
  protected readonly title = signal('');
  protected readonly content = signal('');
  protected readonly effectiveDate = signal<Date | null>(null);
  protected readonly rows = signal<ExistingRow[]>([]);
  protected readonly added = signal<NewRow[]>([]);
  protected readonly error = signal('');
  protected readonly lineName = computed(() => new Map(this.services().map((s) => [s.id, s])));

  constructor() {
    // Điền form khi mở (danh sách dòng HĐ hoặc phụ lục cần sửa thay đổi).
    effect(() => {
      const services = this.services();
      const initial = this.initial();
      untracked(() => this.fill(services, initial));
    });
  }

  protected patchRow(index: number, patch: Partial<ExistingRow>): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  protected patchAdded(index: number, patch: Partial<NewRow>): void {
    this.added.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  protected addRow(): void {
    this.added.update((rows) => [
      ...rows,
      { serviceTypeId: null, period: '', quantity: 1, unitPrice: 0 },
    ]);
  }

  protected removeAdded(index: number): void {
    this.added.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected chooseType(index: number, serviceTypeId: string): void {
    const type = this.serviceTypes().find((t) => t.id === serviceTypeId);
    const row = this.added()[index];
    this.patchAdded(index, {
      serviceTypeId,
      unitPrice: row.unitPrice || Number(type?.defaultPrice ?? 0),
    });
  }

  protected submit(): void {
    const title = this.title().trim();
    if (title.length < 2 || title.length > 200) return this.error.set(this.text.titleRequired);
    const lines: AmendmentLineInput[] = [
      ...this.rows()
        .filter((row) => row.mode !== 'KEEP')
        .map((row) =>
          row.mode === 'REMOVE'
            ? { action: 'REMOVE' as const, contractServiceId: row.lineId }
            : {
                action: 'UPDATE' as const,
                contractServiceId: row.lineId,
                quantity: row.quantity,
                unitPrice: String(row.unitPrice),
              },
        ),
      ...this.added()
        .filter((row) => row.serviceTypeId)
        .map((row) => ({
          action: 'ADD' as const,
          serviceTypeId: row.serviceTypeId!,
          period: row.period.trim() || undefined,
          quantity: row.quantity,
          unitPrice: String(row.unitPrice),
        })),
    ];
    if (!lines.length) return this.error.set(this.text.noChange);
    this.error.set('');
    this.save.emit({
      title,
      content: this.content().trim() || null,
      effectiveDate: toDateString(this.effectiveDate()),
      lines,
    });
  }

  private fill(services: ContractServiceLine[], initial: Amendment | null): void {
    this.title.set(initial?.title ?? '');
    this.content.set(initial?.content ?? '');
    this.effectiveDate.set(fromDateString(initial?.effectiveDate ?? null));
    this.error.set('');
    const changes = new Map(
      (initial?.lines ?? [])
        .filter((l) => l.contractServiceId)
        .map((l) => [l.contractServiceId!, l]),
    );
    this.rows.set(
      services.map((s) => {
        const change = changes.get(s.id);
        return {
          lineId: s.id,
          mode: (change?.action ?? 'KEEP') as Mode,
          quantity: change?.quantity ?? s.quantity,
          unitPrice: Number(change?.unitPrice ?? s.unitPrice ?? 0),
        };
      }),
    );
    this.added.set(
      (initial?.lines ?? [])
        .filter((l) => l.action === 'ADD')
        .map((l) => ({
          serviceTypeId: l.serviceTypeId,
          period: l.period ?? '',
          quantity: l.quantity ?? 1,
          unitPrice: Number(l.unitPrice ?? 0),
        })),
    );
  }
}
