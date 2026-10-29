import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import { CustomerDocument, UploadDocumentInput } from './customers.api';
import { DocumentCategory } from '../customer-labels';

export interface DocumentVersion { id: string; version: number; fileName: string; mimeType: string; size: number; note: string | null; createdAt: string; }
export interface DocumentQuery { page: number; pageSize: number; search?: string; category?: DocumentCategory | null; contractId?: string | null; period?: string | null; }
@Injectable({providedIn: 'root'})
export class CustomerDocumentsApi {
  private readonly http = inject(HttpClient);
  list(customerId: string, query: DocumentQuery) { return this.http.get<Paginated<CustomerDocument>>(`${API_URL}/customers/${customerId}/documents`, {params: toParams({...query})}); }
  versions(id: string, page: number) { return this.http.get<Paginated<DocumentVersion>>(`${API_URL}/documents/${id}/versions`, {params: {page, pageSize: 20}}); }
  upload(customerId: string, file: File, metadata: UploadDocumentInput, documentId?: string) {
    const form = new FormData(); form.append('file', file);
    const fields = documentId ? {note: metadata.note} : {...metadata};
    Object.entries(toParams(fields)).forEach(([key,value]) => form.append(key,value));
    return this.http.post<CustomerDocument>(documentId ? `${API_URL}/documents/${documentId}/versions` : `${API_URL}/customers/${customerId}/documents`, form);
  }
  file(id: string, version: number, preview = false) { return this.http.get(`${API_URL}/documents/${id}/versions/${version}/${preview ? 'preview' : 'download'}`, {responseType: 'blob'}); }
  remove(id: string) { return this.http.delete(`${API_URL}/documents/${id}`); }
}
