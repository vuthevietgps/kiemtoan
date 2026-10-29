import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL, Paginated, toParams } from '../../../core/api/api';
import { UserRef } from './customers.api';

export interface ContactInput { fullName: string; title?: string | null; phone?: string | null; email?: string | null; note?: string | null; isPrimary?: boolean; }
export interface CustomerContact extends ContactInput { id: string; isPrimary: boolean; }
export interface CustomerAssignment { id: string; userId: string; note: string | null; user: UserRef & { email: string; isActive: boolean; leftAt: string | null }; }
export interface AssigneeOption extends UserRef { email: string; }

@Injectable({ providedIn: 'root' })
export class CustomerRelationshipsApi {
  private readonly http = inject(HttpClient);
  private url(id: string) { return `${API_URL}/customers/${id}`; }
  contacts(id: string, page: number, search: string) {
    return this.http.get<Paginated<CustomerContact>>(`${this.url(id)}/contacts`, { params: toParams({page, pageSize: 20, search}) });
  }
  assignments(id: string, page: number) {
    return this.http.get<Paginated<CustomerAssignment>>(`${this.url(id)}/assignments`, { params: {page, pageSize: 20} });
  }
  options(search: string) { return this.http.get<Paginated<AssigneeOption>>(`${API_URL}/customers/assignee-options`, {params: {page: 1, pageSize: 100, search}}); }
  saveContact(id: string, value: ContactInput, contactId?: string) {
    return contactId ? this.http.patch(`${this.url(id)}/contacts/${contactId}`, value) : this.http.post(`${this.url(id)}/contacts`, value);
  }
  removeContact(id: string, contactId: string) { return this.http.delete(`${this.url(id)}/contacts/${contactId}`); }
  assign(id: string, userId: string, note: string) { return this.http.post(`${this.url(id)}/assignments`, {userId, note}); }
  unassign(id: string, assignmentId: string) { return this.http.delete(`${this.url(id)}/assignments/${assignmentId}`); }
}
