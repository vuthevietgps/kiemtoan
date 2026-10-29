import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';

export type TemplateType =
  'QUOTATION' | 'CONTRACT' | 'APPENDIX' | 'ACCEPTANCE' | 'LIQUIDATION' | 'PAYMENT_REQUEST';
export type DocumentSource = 'GENERATED' | 'SIGNED';

export interface DocumentTemplate {
  id: string;
  type: TemplateType;
  name: string;
  description: string | null;
  isActive: boolean;
  version: number;
  fileName: string;
  size: number;
  fields: string[];
  updatedAt: string;
}

export interface TemplateVersion {
  id: string;
  version: number;
  fileName: string;
  size: number;
  fields: string[];
  note: string | null;
  createdAt: string;
}

export interface TemplateField {
  key: string;
  label: string;
}

export interface TemplateFieldCatalog {
  delimiters: [string, string];
  fields: TemplateField[];
  lists: { key: string; label: string; fields: TemplateField[] }[];
}

export interface ContractDocument {
  id: string;
  type: TemplateType;
  source: DocumentSource;
  templateVersion: number | null;
  updatedAt: string;
  template: { id: string; name: string } | null;
  document: {
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    version: number;
    note: string | null;
    createdAt: string;
    uploadedBy: { id: string; fullName: string };
  };
}

/** Mẫu Word (đặc tả 04-C) và hồ sơ thương mại gắn với hợp đồng. */
@Injectable({ providedIn: 'root' })
export class CommercialDocumentsApi {
  private readonly http = inject(HttpClient);

  templates(query: { type?: TemplateType; active?: boolean } = {}): Observable<DocumentTemplate[]> {
    return this.http.get<DocumentTemplate[]>(`${API_URL}/document-templates`, {
      params: toParams(query),
    });
  }

  fields(): Observable<TemplateFieldCatalog> {
    return this.http.get<TemplateFieldCatalog>(`${API_URL}/document-templates/fields`);
  }

  createTemplate(
    file: File,
    input: { type: TemplateType; name: string; description?: string },
  ): Observable<DocumentTemplate> {
    const form = new FormData();
    form.append('file', file);
    Object.entries(toParams(input)).forEach(([key, value]) => form.append(key, value));
    return this.http.post<DocumentTemplate>(`${API_URL}/document-templates`, form);
  }

  addVersion(id: string, file: File, note?: string): Observable<DocumentTemplate> {
    const form = new FormData();
    form.append('file', file);
    if (note) form.append('note', note);
    return this.http.post<DocumentTemplate>(`${API_URL}/document-templates/${id}/versions`, form);
  }

  updateTemplate(
    id: string,
    input: { name?: string; description?: string | null; isActive?: boolean },
  ): Observable<DocumentTemplate> {
    return this.http.patch<DocumentTemplate>(`${API_URL}/document-templates/${id}`, input);
  }

  versions(id: string): Observable<TemplateVersion[]> {
    return this.http.get<TemplateVersion[]>(`${API_URL}/document-templates/${id}/versions`);
  }

  templateFile(id: string, version: number): Observable<Blob> {
    return this.http.get(`${API_URL}/document-templates/${id}/versions/${version}/download`, {
      responseType: 'blob',
    });
  }

  sample(type: TemplateType): Observable<Blob> {
    return this.http.get(`${API_URL}/document-templates/samples/${type}/download`, {
      responseType: 'blob',
    });
  }

  list(contractId: string): Observable<ContractDocument[]> {
    return this.http.get<ContractDocument[]>(`${API_URL}/contracts/${contractId}/documents`);
  }

  generate(
    contractId: string,
    input: { templateId: string; documentId?: string },
  ): Observable<ContractDocument> {
    return this.http.post<ContractDocument>(
      `${API_URL}/contracts/${contractId}/documents/generate`,
      input,
    );
  }

  uploadSigned(
    contractId: string,
    file: File,
    input: { type: TemplateType; documentId?: string },
  ): Observable<ContractDocument> {
    const form = new FormData();
    form.append('file', file);
    Object.entries(toParams(input)).forEach(([key, value]) => form.append(key, value));
    return this.http.post<ContractDocument>(
      `${API_URL}/contracts/${contractId}/documents/signed`,
      form,
    );
  }
}
