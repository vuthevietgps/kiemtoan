import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../../core/api/api';
import { AuthService } from '../../../../core/auth/auth.service';
import { DocumentPdfPreviewComponent } from '../../../customers/components/document-pdf-preview.component';
import { downloadWorkbook } from '../../../customers/pages/customer-import.panel';
import {
  COMMERCIAL_TEXT,
  GENERATABLE_STATUSES,
  SOURCE_LABELS,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPES,
} from '../../commercial-documents.text';
import {
  ContractDocument,
  DocumentSource,
  TemplateType,
} from '../../data-access/commercial-documents.api';
import { ContractDocumentsStore } from '../../data-access/contract-documents.store';
import { ContractDetail } from '../../data-access/contracts.api';

const PREVIEWABLE = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_BYTES = 20 * 1024 * 1024;

/** Hồ sơ thương mại trên HĐ (đặc tả 04-C): tạo DOCX từ mẫu, tải bản scan đã ký, tải về/xem trước. */
@Component({
  selector: 'app-contract-documents-panel',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    DocumentPdfPreviewComponent,
  ],
  templateUrl: './contract-documents.panel.html',
  styles: `
    h3 {
      margin: 0 0 4px;
      font-size: 16px;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin: 12px 0;
    }
    .bar nz-select {
      min-width: 220px;
      max-width: 100%;
    }
  `,
  providers: [ContractDocumentsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractDocumentsPanel implements OnDestroy {
  readonly contract = input.required<ContractDetail>();

  protected readonly store = inject(ContractDocumentsStore);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);
  protected readonly text = COMMERCIAL_TEXT;
  protected readonly typeLabels = TEMPLATE_TYPE_LABELS;
  protected readonly types = TEMPLATE_TYPES;
  protected readonly sourceLabels = SOURCE_LABELS;
  protected readonly canGenerate = computed(
    () =>
      this.auth.can('contracts:update') &&
      this.auth.can('documents:create') &&
      this.auth.can('finance:view'),
  );
  protected readonly canSign = computed(
    () => this.auth.can('contracts:update') && this.auth.can('documents:create'),
  );
  /** Mẫu đang dùng tạo được ở trạng thái HĐ hiện tại. */
  protected readonly templates = computed(() =>
    this.store
      .templates()
      .filter((t) => GENERATABLE_STATUSES[t.type].includes(this.contract().status)),
  );
  protected readonly templateId = signal<string | null>(null);
  protected readonly generateTarget = signal<string | null>(null);
  protected readonly signedType = signal<TemplateType>('CONTRACT');
  protected readonly signedTarget = signal<string | null>(null);
  protected readonly signedInvalid = signal(false);
  protected readonly previewBlob = signal<Blob | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  private objectUrl: string | null = null;
  /** Hồ sơ sinh từ mẫu cùng loại với mẫu đang chọn, để thêm phiên bản mới. */
  protected readonly generatedTargets = computed(() => {
    const template = this.store.templates().find((t) => t.id === this.templateId());
    return template ? this.targets('GENERATED', template.type) : [];
  });
  protected readonly signedTargets = computed(() => this.targets('SIGNED', this.signedType()));

  constructor() {
    effect(() => {
      const id = this.contract().id;
      untracked(() => void this.store.load(id, this.canGenerate()));
    });
  }

  protected chooseTemplate(id: string | null): void {
    this.templateId.set(id);
    this.generateTarget.set(null);
  }

  protected chooseSignedType(type: TemplateType): void {
    this.signedType.set(type);
    this.signedTarget.set(null);
  }

  protected async generate(): Promise<void> {
    const templateId = this.templateId();
    if (templateId && (await this.store.generate(templateId, this.generateTarget()))) {
      this.message.success(this.text.generated);
      this.generateTarget.set(null);
    }
  }

  protected async selectSigned(event: Event): Promise<void> {
    if (this.store.busy() || !(event.target instanceof HTMLInputElement)) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    this.signedInvalid.set(file.size > MAX_BYTES || !/\.(pdf|png|jpe?g)$/i.test(file.name));
    if (this.signedInvalid()) return;
    if (await this.store.uploadSigned(file, this.signedType(), this.signedTarget())) {
      this.message.success(this.text.signedUploaded);
      this.signedTarget.set(null);
    }
  }

  protected canPreview(item: ContractDocument): boolean {
    return PREVIEWABLE.includes(item.document.mimeType);
  }

  protected async open(item: ContractDocument, preview: boolean): Promise<void> {
    try {
      const blob = await this.store.file(item, preview);
      if (!preview) return downloadWorkbook(blob, item.document.fileName);
      this.closePreview();
      this.objectUrl = URL.createObjectURL(blob);
      this.previewBlob.set(blob);
      this.previewUrl.set(this.objectUrl);
    } catch (err) {
      this.store.error.set(errorMessage(err));
    }
  }

  protected closePreview(): void {
    this.previewBlob.set(null);
    this.previewUrl.set(null);
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }

  ngOnDestroy(): void {
    this.closePreview();
  }

  private targets(source: DocumentSource, type: TemplateType): ContractDocument[] {
    return this.store.items().filter((d) => d.source === source && d.type === type);
  }
}
