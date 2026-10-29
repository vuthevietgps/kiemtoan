import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CommercialDocumentsApi } from './commercial-documents.api';
import { DocumentTemplatesStore } from './document-templates.store';

function setup(createTemplate = vi.fn(() => of({}))) {
  const api = {
    templates: vi.fn(() => of([{ id: 't1', type: 'QUOTATION', isActive: true }])),
    fields: vi.fn(() => of({ delimiters: ['{{', '}}'], fields: [], lists: [] })),
    createTemplate,
    updateTemplate: vi.fn(() => of({})),
  };
  TestBed.configureTestingModule({
    providers: [DocumentTemplatesStore, { provide: CommercialDocumentsApi, useValue: api }],
  });
  return { store: TestBed.inject(DocumentTemplatesStore), api };
}

describe('DocumentTemplatesStore', () => {
  it('loads the field catalog once and filters templates by type', async () => {
    const { store, api } = setup();
    await store.load();
    store.filter('CONTRACT');
    await vi.waitFor(() => expect(api.templates).toHaveBeenCalledTimes(2));
    expect(api.templates).toHaveBeenLastCalledWith({ type: 'CONTRACT' });
    expect(api.fields).toHaveBeenCalledTimes(1);
  });

  it('shows the API reason when a template has invalid merge fields', async () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { message: 'Mẫu có trường trộn không hợp lệ: customer.password' },
    });
    const { store } = setup(vi.fn(() => throwError(() => error)));
    const file = new File(['x'], 'mau.docx');
    expect(await store.create(file, { type: 'QUOTATION', name: 'Báo giá' })).toBe(false);
    expect(store.error()).toContain('customer.password');
    expect(store.busy()).toBe(false);
  });

  it('toggles active state and reloads', async () => {
    const { store, api } = setup();
    const ok = await store.setActive({ id: 't1', isActive: true } as never, false);
    expect(ok).toBe(true);
    expect(api.updateTemplate).toHaveBeenCalledWith('t1', { isActive: false });
    expect(api.templates).toHaveBeenCalledTimes(1);
  });
});
