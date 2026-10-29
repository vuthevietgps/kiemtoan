import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import { CustomerInput, CustomersApi, UserOption } from './customers.api';

@Injectable()
export class CustomersStore {
  private readonly api = inject(CustomersApi);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly owners = signal<UserOption[]>([]);
  async loadOwners() {
    try { this.owners.set(await firstValueFrom(this.api.userOptions())); }
    catch (error) { this.error.set(errorMessage(error)); }
  }
  async save(input: CustomerInput, id?: string) {
    if (this.busy()) return null;
    this.busy.set(true); this.error.set('');
    try { return await firstValueFrom(id ? this.api.update(id,input) : this.api.create(input)); }
    catch (error) { this.error.set(errorMessage(error)); return null; }
    finally { this.busy.set(false); }
  }
}
