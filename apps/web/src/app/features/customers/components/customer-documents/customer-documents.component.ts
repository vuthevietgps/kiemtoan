import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { DOCUMENT_CATEGORY_OPTIONS, DocumentCategory } from '../../customer-labels';
import { DOCUMENTS_TEXT } from '../../documents.text';
import { ContractSummary, CustomerDocument, UploadDocumentInput } from '../../data-access/customers.api';
import { DocumentQuery } from '../../data-access/customer-documents.api';

export interface DocumentUpload { file: File; metadata: UploadDocumentInput; id?: string; }
@Component({
  selector: 'app-customer-documents',
  imports: [DatePipe, FormsModule, NzButtonModule, NzInputModule, NzPaginationModule, NzPopconfirmModule, NzSelectModule, NzTableModule],
  templateUrl: './customer-documents.component.html',
  styleUrl: './customer-documents.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDocumentsComponent {
  readonly items = input.required<CustomerDocument[]>();
  readonly total = input(0);
  readonly page = input(1);
  readonly busy = input(false);
  readonly canUpload = input(false);
  readonly canDelete = input(false);
  readonly contracts = input<ContractSummary[]>([]);
  readonly upload = output<DocumentUpload>();
  readonly remove = output<string>();
  readonly history = output<CustomerDocument>();
  readonly download = output<CustomerDocument>();
  readonly queryChange = output<Partial<DocumentQuery>>();
  protected readonly text = DOCUMENTS_TEXT;
  protected readonly categories = DOCUMENT_CATEGORY_OPTIONS;
  protected readonly target = signal<CustomerDocument | null>(null);
  protected category: DocumentCategory = 'LEGAL';
  protected contractId: string | null = null;
  protected period = '';
  protected note = '';
  protected search = '';
  protected filterCategory: DocumentCategory | null = null;
  protected filterContract: string | null = null;
  protected invalid = false;
  reset() { this.target.set(null); this.note = ''; }
  protected select(event: Event) {
    if (this.busy() || !this.canUpload() || !(event.target instanceof HTMLInputElement)) return;
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    this.invalid = file.size > 20 * 1024 * 1024 || !/\.(pdf|png|jpe?g|docx|xlsx|pptx)$/i.test(file.name) || (!!this.period && !/^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/.test(this.period));
    if (!this.invalid) this.upload.emit({file, id: this.target()?.id, metadata: {category: this.category, contractId: this.contractId, period: this.period || null, note: this.note || null}});
  }
}
