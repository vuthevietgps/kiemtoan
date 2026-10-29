import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { IMPORT_TEXT } from '../customer-import.text';
import { CustomerImportApi, CustomerImportPreview } from '../data-access/customer-import.api';

@Component({
  selector: 'app-customer-import-panel',
  imports: [DatePipe, FormsModule, NzAlertModule, NzButtonModule, NzCheckboxModule, NzModalModule, NzTableModule],
  templateUrl: './customer-import.panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerImportPanel {
  readonly open = input(false);
  readonly closed = output<void>();
  readonly imported = output<void>();
  protected readonly text = IMPORT_TEXT;
  protected readonly preview = signal<CustomerImportPreview | null>(null);
  protected readonly busy = signal(false);
  protected readonly approved = signal(false);
  protected readonly error = signal('');
  private readonly api = inject(CustomerImportApi);

  protected async template() {
    try { downloadWorkbook(await firstValueFrom(this.api.template()), 'customer-import-template.xlsx'); }
    catch (error) { this.error.set(errorMessage(error)); }
  }
  protected async select(event: Event) {
    if (this.busy() || !(event.target instanceof HTMLInputElement)) return;
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    this.preview.set(null); this.approved.set(false); this.error.set('');
    if (file.size > 5 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.xlsx')) { this.error.set(this.text.invalidFile); return; }
    this.busy.set(true);
    try { this.preview.set(await firstValueFrom(this.api.preview(file))); }
    catch (error) { this.error.set(errorMessage(error)); }
    finally { this.busy.set(false); }
  }
  protected async confirm() {
    const preview = this.preview();
    if (!preview || !this.approved() || !preview.validCount || this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      await firstValueFrom(this.api.confirm(preview.id, preview.rows.filter(row => !row.errors.length).map(row => row.row)));
      this.preview.set(null); this.approved.set(false); this.imported.emit(); this.closed.emit();
    } catch (error) { this.error.set(errorMessage(error)); }
    finally { this.busy.set(false); }
  }
}

export function downloadWorkbook(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = fileName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
