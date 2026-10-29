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
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  ACCEPTANCE_LABELS,
  AUDIT_TEXT,
  CLIENT_DELIVERY_LABELS,
  ORIGINAL_FILING_LABELS,
} from '../../audit-tracking.text';
import {
  AcceptanceStatus,
  ClientDeliveryStatus,
  ContractDossier,
  DossierInput,
  OriginalFilingStatus,
} from '../../data-access/audit-tracking.api';
import { ContractDocument } from '../../data-access/commercial-documents.api';
import { fromDateString, toDateString } from '../../form-utils';

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

/** Tình trạng hồ sơ HĐ (04-F): gửi khách, lưu bản gốc, BBNT. Chỉ nhận input và phát output. */
@Component({
  selector: 'app-contract-dossier-card',
  imports: [FormsModule, NzButtonModule, NzDatePickerModule, NzInputModule, NzSelectModule],
  template: `
    <div class="panel">
      <h3>{{ text.dossierTitle }}</h3>
      <div class="grid">
        <div>
          <label for="delivery">{{ text.clientDelivery }}</label>
          <nz-select
            nzId="delivery"
            [nzDisabled]="!canEdit()"
            [ngModel]="delivery()"
            (ngModelChange)="delivery.set($event)"
          >
            @for (o of deliveryOptions; track o.value) {
              <nz-option [nzValue]="o.value" [nzLabel]="o.label" />
            }
          </nz-select>
        </div>
        @if (delivery() !== 'NOT_SENT') {
          <div>
            <label for="delivered-at">{{ text.deliveredAt }}</label>
            <nz-date-picker
              nzId="delivered-at"
              nzFormat="dd/MM/yyyy"
              [nzDisabled]="!canEdit()"
              [ngModel]="deliveredAt()"
              (ngModelChange)="deliveredAt.set($event)"
            />
          </div>
        }
        <div>
          <label for="filing">{{ text.originalFiling }}</label>
          <nz-select
            nzId="filing"
            [nzDisabled]="!canEdit()"
            [ngModel]="filing()"
            (ngModelChange)="filing.set($event)"
          >
            @for (o of filingOptions; track o.value) {
              <nz-option [nzValue]="o.value" [nzLabel]="o.label" />
            }
          </nz-select>
        </div>
        @if (filing() === 'FILED') {
          <div>
            <label for="filed-at">{{ text.filedAt }}</label>
            <nz-date-picker
              nzId="filed-at"
              nzFormat="dd/MM/yyyy"
              [nzDisabled]="!canEdit()"
              [ngModel]="filedAt()"
              (ngModelChange)="filedAt.set($event)"
            />
          </div>
        }
        @if (filing() !== 'NOT_FILED') {
          <div>
            <label for="filing-note">{{ text.filingNote }}</label>
            <input
              id="filing-note"
              nz-input
              maxlength="200"
              [disabled]="!canEdit()"
              [ngModel]="filingNote()"
              (ngModelChange)="filingNote.set($event)"
            />
          </div>
        }
        <div>
          <label for="acceptance">{{ text.acceptance }}</label>
          <nz-select
            nzId="acceptance"
            [nzDisabled]="!canEdit()"
            [ngModel]="acceptance()"
            (ngModelChange)="acceptance.set($event)"
          >
            @for (o of acceptanceOptions; track o.value) {
              <nz-option [nzValue]="o.value" [nzLabel]="o.label" />
            }
          </nz-select>
        </div>
        @if (acceptance() === 'SIGNED') {
          <div>
            <label for="signed-at">{{ text.signedAt }}</label>
            <nz-date-picker
              nzId="signed-at"
              nzFormat="dd/MM/yyyy"
              [nzDisabled]="!canEdit()"
              [ngModel]="signedAt()"
              (ngModelChange)="signedAt.set($event)"
            />
          </div>
          <div>
            <label for="acceptance-doc">{{ text.acceptanceDoc }}</label>
            <nz-select
              nzId="acceptance-doc"
              [nzDisabled]="!canEdit()"
              [nzPlaceHolder]="text.acceptanceDocHint"
              [ngModel]="documentId()"
              (ngModelChange)="documentId.set($event)"
            >
              @for (d of docs(); track d.id) {
                <nz-option [nzValue]="d.id" [nzLabel]="d.document.fileName" />
              }
            </nz-select>
          </div>
        }
      </div>
      @if (canEdit()) {
        <button
          nz-button
          nzType="primary"
          type="button"
          [nzLoading]="busy()"
          [disabled]="!valid()"
          (click)="submit()"
        >
          {{ text.dossierSave }}
        </button>
      }
    </div>
  `,
  styles: `
    h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px 16px;
      margin-bottom: 12px;
    }
    .grid label {
      display: block;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.55);
      margin-bottom: 2px;
    }
    .grid nz-select,
    .grid nz-date-picker {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractDossierCardComponent {
  readonly dossier = input.required<ContractDossier>();
  readonly canEdit = input(false);
  readonly docs = input<ContractDocument[]>([]);
  readonly busy = input(false);
  readonly save = output<DossierInput>();

  protected readonly text = AUDIT_TEXT;
  protected readonly deliveryOptions = options(CLIENT_DELIVERY_LABELS);
  protected readonly filingOptions = options(ORIGINAL_FILING_LABELS);
  protected readonly acceptanceOptions = options(ACCEPTANCE_LABELS);

  protected readonly delivery = signal<ClientDeliveryStatus>('NOT_SENT');
  protected readonly deliveredAt = signal<Date | null>(null);
  protected readonly filing = signal<OriginalFilingStatus>('NOT_FILED');
  protected readonly filedAt = signal<Date | null>(null);
  protected readonly filingNote = signal('');
  protected readonly acceptance = signal<AcceptanceStatus>('NONE');
  protected readonly signedAt = signal<Date | null>(null);
  protected readonly documentId = signal<string | null>(null);

  /** Ngày bắt buộc khi đã gửi/lưu/ký; BBNT đã ký phải chọn bản đã ký (F8). */
  protected readonly valid = computed(
    () =>
      (this.delivery() === 'NOT_SENT' || !!this.deliveredAt()) &&
      (this.filing() !== 'FILED' || !!this.filedAt()) &&
      (this.acceptance() !== 'SIGNED' || (!!this.signedAt() && !!this.documentId())),
  );

  constructor() {
    effect(() => {
      const d = this.dossier();
      untracked(() => {
        this.delivery.set(d.clientDeliveryStatus);
        this.deliveredAt.set(fromDateString(d.clientDeliveredAt));
        this.filing.set(d.originalFilingStatus);
        this.filedAt.set(fromDateString(d.originalFiledAt));
        this.filingNote.set(d.originalFilingNote ?? '');
        this.acceptance.set(d.acceptanceStatus);
        this.signedAt.set(fromDateString(d.acceptanceSignedAt));
        this.documentId.set(d.acceptanceDocument?.id ?? null);
      });
    });
  }

  protected submit(): void {
    if (!this.valid()) return;
    this.save.emit({
      revision: this.dossier().revision,
      clientDeliveryStatus: this.delivery(),
      clientDeliveredAt: toDateString(this.deliveredAt()),
      originalFilingStatus: this.filing(),
      originalFiledAt: toDateString(this.filedAt()),
      originalFilingNote: this.filingNote().trim() || null,
      acceptanceStatus: this.acceptance(),
      acceptanceSignedAt: toDateString(this.signedAt()),
      acceptanceDocumentId: this.documentId(),
    });
  }
}
