import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL, toParams } from '../../../core/api/api';
import { CustomerQuery } from './customers.api';

export interface CustomerImportPreview { id: string; expiresAt: string; validCount: number; invalidCount: number; rows: {row: number; input: {name: string; taxCode: string}; ownerEmail: string; errors: string[]}[]; }
@Injectable({providedIn: 'root'})
export class CustomerImportApi {
  private readonly http = inject(HttpClient);
  template() { return this.http.get(`${API_URL}/customers/import-template`, {responseType: 'blob'}); }
  export(query: CustomerQuery) { return this.http.get(`${API_URL}/customers/export`, {params: toParams({...query}), responseType: 'blob'}); }
  preview(file: File) { const form = new FormData(); form.append('file', file); return this.http.post<CustomerImportPreview>(`${API_URL}/customers/imports/preview`, form); }
  confirm(id: string, rows: number[]) { return this.http.post<{count: number}>(`${API_URL}/customers/imports/${id}/confirm`, {rows}); }
}
