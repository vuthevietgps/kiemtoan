import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentRequestRow, DocumentRequestsApi, WAITING_STATUSES } from './document-requests.api';

describe('DocumentRequestsApi (10-B, nhóm "Chờ khách")', () => {
  let api: DocumentRequestsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(DocumentRequestsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('nhiều trạng thái: gọi từng trạng thái (giữ bộ lọc khác) rồi gộp kết quả', async () => {
    const pending = firstValueFrom(api.list({ customerId: 'c1', statuses: WAITING_STATUSES }));
    const row = (id: string) => ({ id }) as DocumentRequestRow;
    const requests = http.match((r) => r.url.endsWith('/customer-document-requests'));
    expect(
      requests.map((r) => [r.request.params.get('status'), r.request.params.get('customerId')]),
    ).toEqual([
      ['REQUESTED', 'c1'],
      ['NEEDS_SUPPLEMENT', 'c1'],
    ]);
    requests[0].flush([row('a')]);
    requests[1].flush([row('b'), row('c')]);
    expect((await pending).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('một trạng thái: một lần gọi như cũ', async () => {
    const pending = firstValueFrom(api.list({ status: 'ACCEPTED' }));
    const request = http.expectOne((r) => r.url.endsWith('/customer-document-requests'));
    expect(request.request.params.get('status')).toBe('ACCEPTED');
    request.flush([]);
    expect(await pending).toEqual([]);
  });
});
