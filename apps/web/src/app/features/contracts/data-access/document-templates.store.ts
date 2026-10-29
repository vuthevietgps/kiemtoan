import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import {
  CommercialDocumentsApi,
  DocumentTemplate,
  TemplateFieldCatalog,
  TemplateType,
  TemplateVersion,
} from './commercial-documents.api';

/** Trang quản lý mẫu Word (04-C, chỉ giám đốc). */
@Injectable()
export class DocumentTemplatesStore {
  readonly api = inject(CommercialDocumentsApi);
  readonly items = signal<DocumentTemplate[]>([]);
  readonly catalog = signal<TemplateFieldCatalog | null>(null);
  readonly type = signal<TemplateType | null>(null);
  readonly history = signal<TemplateVersion[]>([]);
  readonly historyOf = signal<DocumentTemplate | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  private loadId = 0;

  async load(): Promise<void> {
    const id = ++this.loadId;
    this.loading.set(true);
    this.error.set('');
    try {
      const [items, catalog] = await Promise.all([
        firstValueFrom(this.api.templates({ type: this.type() ?? undefined })),
        this.catalog() ?? firstValueFrom(this.api.fields()),
      ]);
      if (id !== this.loadId) return;
      this.items.set(items);
      this.catalog.set(catalog);
    } catch (err) {
      if (id === this.loadId) this.error.set(errorMessage(err));
    } finally {
      if (id === this.loadId) this.loading.set(false);
    }
  }

  filter(type: TemplateType | null): void {
    this.type.set(type);
    void this.load();
  }

  create(
    file: File,
    input: { type: TemplateType; name: string; description?: string },
  ): Promise<boolean> {
    return this.perform(this.api.createTemplate(file, input));
  }

  replace(id: string, file: File): Promise<boolean> {
    return this.perform(this.api.addVersion(id, file));
  }

  setActive(template: DocumentTemplate, isActive: boolean): Promise<boolean> {
    return this.perform(this.api.updateTemplate(template.id, { isActive }));
  }

  async openHistory(template: DocumentTemplate): Promise<void> {
    this.historyOf.set(template);
    this.history.set([]);
    try {
      this.history.set(await firstValueFrom(this.api.versions(template.id)));
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  file(id: string, version: number): Promise<Blob> {
    return firstValueFrom(this.api.templateFile(id, version));
  }

  sample(type: TemplateType): Promise<Blob> {
    return firstValueFrom(this.api.sample(type));
  }

  private async perform(action: Observable<unknown>): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(action);
      await this.load();
      return true;
    } catch (err) {
      this.error.set(errorMessage(err));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
