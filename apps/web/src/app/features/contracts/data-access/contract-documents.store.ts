import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { CustomerDocumentsApi } from '../../customers/data-access/customer-documents.api';
import {
  CommercialDocumentsApi,
  ContractDocument,
  DocumentTemplate,
} from './commercial-documents.api';

/** Hồ sơ thương mại của một HĐ (04-C): danh sách, mẫu đang dùng, tạo từ mẫu và tải bản đã ký. */
@Injectable()
export class ContractDocumentsStore {
  private readonly api = inject(CommercialDocumentsApi);
  private readonly files = inject(CustomerDocumentsApi);
  private contractId = '';
  private loadId = 0;
  readonly items = signal<ContractDocument[]>([]);
  readonly templates = signal<DocumentTemplate[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  async load(contractId: string, withTemplates: boolean): Promise<void> {
    const id = ++this.loadId;
    this.contractId = contractId;
    this.loading.set(true);
    this.error.set('');
    try {
      const [items, templates] = await Promise.all([
        firstValueFrom(this.api.list(contractId)),
        withTemplates && !this.templates().length
          ? firstValueFrom(this.api.templates({ active: true }))
          : Promise.resolve(this.templates()),
      ]);
      if (id !== this.loadId) return;
      this.items.set(items);
      this.templates.set(templates);
    } catch (err) {
      if (id === this.loadId) this.error.set(errorMessage(err));
    } finally {
      if (id === this.loadId) this.loading.set(false);
    }
  }

  generate(templateId: string, documentId: string | null): Promise<boolean> {
    return this.perform(
      this.api.generate(this.contractId, { templateId, documentId: documentId ?? undefined }),
    );
  }

  uploadSigned(
    file: File,
    type: ContractDocument['type'],
    documentId: string | null,
  ): Promise<boolean> {
    return this.perform(
      this.api.uploadSigned(this.contractId, file, { type, documentId: documentId ?? undefined }),
    );
  }

  /** Tải file qua API kho hồ sơ (02), phiên bản hiện hành. */
  file(item: ContractDocument, preview = false): Promise<Blob> {
    return firstValueFrom(this.files.file(item.document.id, item.document.version, preview));
  }

  private async perform(action: Observable<unknown>): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(action);
      await this.load(this.contractId, false);
      return true;
    } catch (err) {
      this.error.set(errorMessage(err));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
