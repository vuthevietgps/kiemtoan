import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import {
  ServiceCatalogApi,
  ServiceType,
} from '../../service-catalog/data-access/service-catalog.api';
import { Amendment, AmendmentInput, ContractLifecycleApi } from './contract-lifecycle.api';

/** Phụ lục của một HĐ (04-D): danh sách, lưu nháp, gửi duyệt, duyệt, trả lại, huỷ. */
@Injectable()
export class ContractAmendmentsStore {
  private readonly api = inject(ContractLifecycleApi);
  private readonly catalog = inject(ServiceCatalogApi);
  private contractId = '';
  private loadId = 0;
  readonly items = signal<Amendment[]>([]);
  readonly serviceTypes = signal<ServiceType[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  async load(contractId: string): Promise<void> {
    const id = ++this.loadId;
    this.contractId = contractId;
    this.loading.set(true);
    this.error.set('');
    try {
      const items = await firstValueFrom(this.api.amendments(contractId));
      if (id === this.loadId) this.items.set(items);
    } catch (err) {
      if (id === this.loadId) this.error.set(errorMessage(err));
    } finally {
      if (id === this.loadId) this.loading.set(false);
    }
  }

  /** Dịch vụ đang cung cấp để thêm dòng mới; tải một lần khi mở form. */
  async loadServiceTypes(): Promise<void> {
    if (this.serviceTypes().length) return;
    try {
      const types = await firstValueFrom(this.catalog.list());
      this.serviceTypes.set(types.filter((t) => t.isActive));
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  save(input: AmendmentInput, amendmentId?: string): Promise<boolean> {
    return this.perform(this.api.saveAmendment(this.contractId, input, amendmentId));
  }

  act(amendmentId: string, action: 'submit' | 'cancel' | 'approve'): Promise<boolean> {
    return this.perform(this.api.amendmentAction(this.contractId, amendmentId, action));
  }

  returnToDraft(amendmentId: string, reason: string): Promise<boolean> {
    return this.perform(this.api.returnAmendment(this.contractId, amendmentId, reason));
  }

  private async perform(action: Observable<unknown>): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(action);
      await this.load(this.contractId);
      return true;
    } catch (err) {
      this.error.set(errorMessage(err));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
