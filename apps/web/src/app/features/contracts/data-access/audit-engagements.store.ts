import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import type { TaskPriority } from '../../tasks/task-labels';
import {
  AuditStage,
  AuditTrackingApi,
  ContractAuditView,
  DeadlineKind,
  DossierInput,
  TeamInput,
} from './audit-tracking.api';
import { CommercialDocumentsApi, ContractDocument } from './commercial-documents.api';
import { ContractsApi, UserOption } from './contracts.api';

/** Hồ sơ kiểm toán và tình trạng hồ sơ của một HĐ (04-F): dùng cho ngăn chi tiết và tab Kiểm toán. */
@Injectable()
export class AuditEngagementsStore {
  private readonly api = inject(AuditTrackingApi);
  private readonly contracts = inject(ContractsApi);
  private readonly documents = inject(CommercialDocumentsApi);
  private contractId = '';
  private loadId = 0;
  readonly view = signal<ContractAuditView | null>(null);
  /** Tài khoản nội bộ chọn được (bỏ tài khoản quản trị). */
  readonly users = signal<UserOption[]>([]);
  /** Bản đã ký loại Biên bản nghiệm thu của HĐ (bằng chứng BBNT "Đã ký", F8). */
  readonly acceptanceDocs = signal<ContractDocument[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  async load(contractId: string): Promise<void> {
    const id = ++this.loadId;
    this.contractId = contractId;
    this.loading.set(true);
    this.error.set('');
    try {
      const [view, users, docs] = await Promise.all([
        firstValueFrom(this.api.engagements(contractId)),
        this.users().length
          ? Promise.resolve(this.users())
          : firstValueFrom(this.contracts.userOptions()),
        firstValueFrom(this.documents.list(contractId)).catch(() => [] as ContractDocument[]),
      ]);
      if (id !== this.loadId) return;
      this.view.set(view);
      this.users.set(users.filter((u) => u.role !== 'ADMIN'));
      this.acceptanceDocs.set(docs.filter((d) => d.type === 'ACCEPTANCE' && d.source === 'SIGNED'));
    } catch (err) {
      if (id === this.loadId) this.error.set(errorMessage(err));
    } finally {
      if (id === this.loadId) this.loading.set(false);
    }
  }

  save(lineId: string, input: TeamInput): Promise<boolean> {
    return this.run(this.api.save(this.contractId, lineId, input));
  }

  stage(lineId: string, revision: number, stage: AuditStage, reason?: string): Promise<boolean> {
    return this.run(this.api.stage(this.contractId, lineId, { stage, revision, reason }));
  }

  issue(
    lineId: string,
    input: {
      revision: number;
      reportNumber: string;
      reportDate: string;
      signer1Id?: string | null;
    },
    file: File | null,
  ): Promise<boolean> {
    return this.run(this.api.issue(this.contractId, lineId, input, file));
  }

  priority(lineId: string, priority: TaskPriority): Promise<boolean> {
    return this.run(this.api.priority(this.contractId, lineId, priority));
  }

  note(lineId: string, content: string): Promise<boolean> {
    return this.run(this.api.note(this.contractId, lineId, content));
  }

  reopen(lineId: string, revision: number, reason: string): Promise<boolean> {
    return this.run(this.api.reopen(this.contractId, lineId, { revision, reason }));
  }

  extend(
    lineId: string,
    kind: DeadlineKind,
    input: { revision: number; due: string; reason: string },
  ): Promise<boolean> {
    return this.run(this.api.extend(this.contractId, lineId, kind, input));
  }

  dossier(input: DossierInput): Promise<boolean> {
    return this.run(this.api.dossier(this.contractId, input));
  }

  /** Lệnh trả về dữ liệu mới của cả HĐ; lỗi 409 (người khác vừa sửa) thì tải lại để thấy bản mới. */
  private async run(action: Observable<ContractAuditView>): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    try {
      this.view.set(await firstValueFrom(action));
      return true;
    } catch (err) {
      if ((err as { status?: number }).status === 409) await this.load(this.contractId);
      this.error.set(errorMessage(err));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
