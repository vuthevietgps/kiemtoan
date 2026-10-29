import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { errorMessage } from '../../../../core/api/api';
import { PageHeaderComponent } from '../../../../shared/components/page-header.component';
import { downloadWorkbook } from '../../../customers/pages/customer-import.panel';
import {
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPES,
  TEMPLATES_TEXT,
} from '../../commercial-documents.text';
import { DocumentTemplate, TemplateType } from '../../data-access/commercial-documents.api';
import { DocumentTemplatesStore } from '../../data-access/document-templates.store';

const DOCX = /\.docx$/i;
const MAX_BYTES = 20 * 1024 * 1024;

/** Quản lý mẫu Word hồ sơ thương mại (đặc tả 04-C): tải mẫu, thay file, ngừng dùng, lịch sử. */
@Component({
  selector: 'app-document-templates-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCollapseModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
  ],
  templateUrl: './document-templates.page.html',
  styles: `
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }
    .bar nz-select {
      min-width: 200px;
      max-width: 100%;
    }
    .bar input[nz-input] {
      width: 260px;
      max-width: 100%;
    }
    h3 {
      margin: 0 0 12px;
      font-size: 16px;
    }
    code {
      white-space: nowrap;
    }
  `,
  providers: [DocumentTemplatesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentTemplatesPage implements OnInit {
  protected readonly store = inject(DocumentTemplatesStore);
  private readonly message = inject(NzMessageService);
  protected readonly text = TEMPLATES_TEXT;
  protected readonly typeLabels = TEMPLATE_TYPE_LABELS;
  protected readonly types = TEMPLATE_TYPES;
  protected readonly newType = signal<TemplateType>('QUOTATION');
  protected readonly newName = signal('');
  protected readonly newDescription = signal('');
  protected readonly invalid = signal('');
  protected readonly sampleType = signal<TemplateType>('QUOTATION');
  /** Mẫu đang chờ chọn file để thay phiên bản. */
  private replaceTarget: DocumentTemplate | null = null;
  private readonly replaceInput = viewChild<ElementRef<HTMLInputElement>>('replaceInput');

  ngOnInit(): void {
    void this.store.load();
  }

  protected token(key: string): string {
    return `{{${key}}}`;
  }

  protected async create(event: Event): Promise<void> {
    const file = this.pick(event);
    if (!file) return;
    const name = this.newName().trim();
    if (name.length < 2 || name.length > 200) return this.invalid.set(this.text.nameRequired);
    const description = this.newDescription().trim() || undefined;
    if (await this.store.create(file, { type: this.newType(), name, description })) {
      this.message.success(this.text.created);
      this.newName.set('');
      this.newDescription.set('');
    }
  }

  protected chooseReplacement(template: DocumentTemplate): void {
    this.replaceTarget = template;
    this.replaceInput()?.nativeElement.click();
  }

  protected async replace(event: Event): Promise<void> {
    const file = this.pick(event);
    const target = this.replaceTarget;
    this.replaceTarget = null;
    if (file && target && (await this.store.replace(target.id, file)))
      this.message.success(this.text.replaced);
  }

  protected async toggle(template: DocumentTemplate): Promise<void> {
    if (await this.store.setActive(template, !template.isActive))
      this.message.success(this.text.saved);
  }

  protected async download(id: string, version: number, fileName: string): Promise<void> {
    try {
      downloadWorkbook(await this.store.file(id, version), fileName);
    } catch (err) {
      this.store.error.set(errorMessage(err));
    }
  }

  protected async downloadSample(): Promise<void> {
    const type = this.sampleType();
    try {
      downloadWorkbook(await this.store.sample(type), `Mau vi du - ${this.typeLabels[type]}.docx`);
    } catch (err) {
      this.store.error.set(errorMessage(err));
    }
  }

  /** Lấy file .docx từ ô chọn file; sai định dạng/dung lượng thì báo ngay, không gửi lên. */
  private pick(event: Event): File | null {
    if (this.store.busy() || !(event.target instanceof HTMLInputElement)) return null;
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    this.invalid.set('');
    if (file && (!DOCX.test(file.name) || file.size > MAX_BYTES)) {
      this.invalid.set(this.text.invalidFile);
      return null;
    }
    return file;
  }
}
