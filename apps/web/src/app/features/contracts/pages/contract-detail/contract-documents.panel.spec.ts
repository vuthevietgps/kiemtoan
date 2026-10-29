import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { CustomerDocumentsApi } from '../../../customers/data-access/customer-documents.api';
import {
  CommercialDocumentsApi,
  DocumentTemplate,
} from '../../data-access/commercial-documents.api';
import { ContractDetail } from '../../data-access/contracts.api';
import { ContractDocumentsPanel } from './contract-documents.panel';

const template = (id: string, type: DocumentTemplate['type']) =>
  ({ id, type, name: id, isActive: true, version: 1, fields: [] }) as unknown as DocumentTemplate;

async function setup(permissions: string[], status = 'DRAFT') {
  const api = {
    list: vi.fn(() => of([])),
    templates: vi.fn(() => of([template('bg', 'QUOTATION'), template('dntt', 'PAYMENT_REQUEST')])),
    generate: vi.fn(() => of({})),
    uploadSigned: vi.fn(() => of({})),
  };
  await TestBed.configureTestingModule({
    imports: [ContractDocumentsPanel],
    providers: [
      { provide: CommercialDocumentsApi, useValue: api },
      { provide: CustomerDocumentsApi, useValue: { file: vi.fn() } },
      { provide: AuthService, useValue: { can: (p: string) => permissions.includes(p) } },
      { provide: NzMessageService, useValue: { success: vi.fn() } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ContractDocumentsPanel);
  fixture.componentRef.setInput('contract', { id: 'c1', status } as ContractDetail);
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
  return { fixture, api, text: (fixture.nativeElement as HTMLElement).textContent ?? '' };
}

describe('ContractDocumentsPanel', () => {
  it('offers only templates allowed in the contract status and generates once', async () => {
    const { fixture, api } = await setup(['contracts:update', 'documents:create', 'finance:view']);
    expect(api.list).toHaveBeenCalledTimes(1);
    const panel = fixture.componentInstance as unknown as {
      templates: () => DocumentTemplate[];
      chooseTemplate: (id: string) => void;
      generate: () => Promise<void>;
    };
    expect(panel.templates().map((t) => t.id)).toEqual(['bg']);
    panel.chooseTemplate('bg');
    await panel.generate();
    expect(api.generate).toHaveBeenCalledWith('c1', { templateId: 'bg', documentId: undefined });
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('hides generation without financial access and does not load templates', async () => {
    const { api, text } = await setup(['contracts:update', 'documents:create']);
    expect(api.templates).not.toHaveBeenCalled();
    expect(text).toContain('Tạo hồ sơ cần quyền xem tài chính');
    expect(text).toContain('Bản scan đã ký');
  });

  it('shows the list only for viewers without update permission', async () => {
    const { api, text } = await setup(['contracts:view'], 'IN_PROGRESS');
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(text).not.toContain('Bản scan đã ký:');
    expect(text).toContain('Chưa có hồ sơ thương mại');
  });
});
