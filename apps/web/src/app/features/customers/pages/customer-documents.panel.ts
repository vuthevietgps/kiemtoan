import { ChangeDetectionStrategy, Component, effect, inject, input, OnDestroy, output, signal, untracked, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { CustomerDocumentsComponent, DocumentUpload } from '../components/customer-documents/customer-documents.component';
import { CustomerDocumentsStore } from '../data-access/customer-documents.store';
import { DocumentQuery } from '../data-access/customer-documents.api';
import { DocumentPdfPreviewComponent } from '../components/document-pdf-preview.component';
import { ContractSummary, CustomerDocument } from '../data-access/customers.api';
import { DOCUMENTS_TEXT } from '../documents.text';
import { downloadWorkbook } from './customer-import.panel';

@Component({
  selector: 'app-customer-documents-panel',
  imports: [CustomerDocumentsComponent, DocumentPdfPreviewComponent, DatePipe, NzAlertModule, NzButtonModule, NzModalModule, NzPaginationModule, NzSpinModule, NzTableModule],
  providers: [CustomerDocumentsStore],
  templateUrl: './customer-documents.panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDocumentsPanel implements OnDestroy {
  readonly customerId = input.required<string>();
  readonly contracts = input<ContractSummary[]>([]);
  readonly changed = output<void>();
  protected readonly store = inject(CustomerDocumentsStore);
  protected readonly auth = inject(AuthService);
  protected readonly text = DOCUMENTS_TEXT;
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly previewBlob = signal<Blob | null>(null);
  private objectUrl: string | null = null;
  private previewRequest = 0;
  private readonly form = viewChild(CustomerDocumentsComponent);
  constructor() { effect(() => { const id = this.customerId(); untracked(() => { this.closePreview(); void this.store.load(id); }); }); }
  protected async upload(event: DocumentUpload) {
    if (await this.store.perform(this.customerId(), this.store.api.upload(this.customerId(), event.file, event.metadata, event.id))) { this.form()?.reset(); this.changed.emit(); }
  }
  protected async remove(id: string) { if (await this.store.perform(this.customerId(), this.store.api.remove(id))) this.changed.emit(); }
  protected download(document: CustomerDocument) { void this.file(document.id, document.version, document.fileName); }
  protected filter(query: Partial<DocumentQuery>) { this.store.query.update(current => ({...current, ...query})); void this.store.load(this.customerId()); }
  protected async file(id: string, version: number, fileName: string, preview = false) {
    const request = ++this.previewRequest;
    try {
      const blob = await firstValueFrom(this.store.api.file(id, version, preview));
      if (request !== this.previewRequest) return;
      if (!preview) { downloadWorkbook(blob, fileName); return; }
      if (!['application/pdf','image/png','image/jpeg'].includes(blob.type)) throw new Error(this.text.invalid);
      this.closePreview(); this.objectUrl = URL.createObjectURL(blob);
      this.previewBlob.set(blob); this.previewUrl.set(this.objectUrl);
    } catch (error) { if (request === this.previewRequest) this.store.error.set(errorMessage(error)); }
  }
  protected closePreview() { this.previewRequest++; this.previewBlob.set(null); this.previewUrl.set(null); if (this.objectUrl) URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
  ngOnDestroy() { this.closePreview(); }
}
