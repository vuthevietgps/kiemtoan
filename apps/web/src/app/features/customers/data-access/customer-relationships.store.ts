import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { AssigneeOption, CustomerAssignment, CustomerContact, CustomerRelationshipsApi } from './customer-relationships.api';

@Injectable()
export class CustomerRelationshipsStore {
  private readonly api = inject(CustomerRelationshipsApi);
  private request = 0;
  private optionRequest = 0;
  readonly contacts = signal<CustomerContact[]>([]);
  readonly assignments = signal<CustomerAssignment[]>([]);
  readonly options = signal<AssigneeOption[]>([]);
  readonly contactPage = signal(1);
  readonly assignmentPage = signal(1);
  readonly contactTotal = signal(0);
  readonly assignmentTotal = signal(0);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  async load(id: string) {
    const request = ++this.request;
    this.loading.set(true); this.error.set('');
    try {
      const [contacts, assignments] = await Promise.all([
        firstValueFrom(this.api.contacts(id, this.contactPage(), this.search())),
        firstValueFrom(this.api.assignments(id, this.assignmentPage())),
      ]);
      if (request !== this.request) return;
      this.contacts.set(contacts.items); this.contactTotal.set(contacts.total);
      this.assignments.set(assignments.items); this.assignmentTotal.set(assignments.total);
    } catch (error) { if (request === this.request) this.error.set(errorMessage(error)); }
    finally { if (request === this.request) this.loading.set(false); }
  }

  async loadOptions(search = '') {
    const request = ++this.optionRequest;
    try { const result = await firstValueFrom(this.api.options(search)); if (request === this.optionRequest) this.options.set(result.items); }
    catch (error) { if (request === this.optionRequest) this.error.set(errorMessage(error)); }
  }

  async perform(id: string, action: Observable<unknown>) {
    if (this.busy()) return false;
    this.busy.set(true); this.error.set('');
    try { await firstValueFrom(action); await this.load(id); return true; }
    catch (error) { this.error.set(errorMessage(error)); return false; }
    finally { this.busy.set(false); }
  }
}
