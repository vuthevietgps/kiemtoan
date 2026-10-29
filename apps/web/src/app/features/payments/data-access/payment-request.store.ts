import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { GeneratedDocument, PaymentRequestPreview, PaymentsApi } from './payments.api';

/** Trạng thái hộp thoại đề nghị thanh toán (07-D3): xem trước theo đợt chọn, tạo và tải file Word. */
@Injectable()
export class PaymentRequestStore {
  private readonly api = inject(PaymentsApi);
  private request = 0;

  readonly preview = signal<PaymentRequestPreview | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  reset(): void {
    this.request++;
    this.preview.set(null);
    this.error.set('');
    this.loading.set(false);
  }

  /** Xem trước; chọn rỗng thì xoá xem trước. Kết quả cũ (đổi chọn nhanh) bị bỏ qua. */
  async load(contractId: string, installmentIds: string[]): Promise<void> {
    const request = ++this.request;
    this.error.set('');
    if (!installmentIds.length) {
      this.preview.set(null);
      return;
    }
    this.loading.set(true);
    try {
      const preview = await firstValueFrom(
        this.api.previewPaymentRequest({ contractId, installmentIds }),
      );
      if (request === this.request) this.preview.set(preview);
    } catch (err) {
      if (request === this.request) {
        this.preview.set(null);
        this.error.set(errorMessage(err));
      }
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  /** Tạo DOCX (lưu kho hồ sơ HĐ) rồi tải file về; trả hồ sơ đã tạo, lỗi giữ trong `error`. */
  async create(
    contractId: string,
    installmentIds: string[],
  ): Promise<{ document: GeneratedDocument; file: Blob } | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.error.set('');
    try {
      const document = await firstValueFrom(
        this.api.createPaymentRequest({ contractId, installmentIds }),
      );
      const file = await firstValueFrom(this.api.document(document.document.id));
      return { document, file };
    } catch (err) {
      this.error.set(errorMessage(err));
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}
