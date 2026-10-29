import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { RELATIONSHIP_TEXT } from '../../customer-relationships.text';
import { AssigneeOption, ContactInput, CustomerAssignment, CustomerContact } from '../../data-access/customer-relationships.api';

export type RelationshipAction =
  | { type: 'contact'; id?: string; value: ContactInput }
  | { type: 'removeContact'; id: string }
  | { type: 'unassign'; id: string }
  | { type: 'assign'; userId: string; note: string };

@Component({
  selector: 'app-customer-relationships',
  imports: [FormsModule, ReactiveFormsModule, NzButtonModule, NzCheckboxModule, NzFormModule, NzInputModule, NzPaginationModule, NzPopconfirmModule, NzSelectModule, NzTableModule, NzTagModule],
  templateUrl: './customer-relationships.component.html',
  styleUrl: './customer-relationships.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerRelationshipsComponent {
  readonly contacts = input.required<CustomerContact[]>();
  readonly assignments = input.required<CustomerAssignment[]>();
  readonly options = input.required<AssigneeOption[]>();
  readonly canManage = input(false);
  readonly busy = input(false);
  readonly contactPage = input(1);
  readonly contactTotal = input(0);
  readonly assignmentPage = input(1);
  readonly assignmentTotal = input(0);
  readonly action = output<RelationshipAction>();
  readonly contactPageChange = output<number>();
  readonly assignmentPageChange = output<number>();
  readonly searchChange = output<string>();
  readonly personSearch = output<string>();
  protected readonly text = RELATIONSHIP_TEXT;
  protected readonly editing = signal<string | undefined>(undefined);
  protected readonly selectedUser = signal<string | null>(null);
  protected readonly assignmentNote = signal('');
  protected readonly form = inject(NonNullableFormBuilder).group({
    fullName: ['', [Validators.required, Validators.maxLength(200)]],
    title: ['', Validators.maxLength(100)], phone: ['', Validators.maxLength(30)],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    note: ['', Validators.maxLength(2000)], isPrimary: [false],
  });

  edit(contact: CustomerContact) { this.editing.set(contact.id); this.form.reset({ ...contact, title: contact.title ?? '', phone: contact.phone ?? '', email: contact.email ?? '', note: contact.note ?? '' }); }
  reset() { this.editing.set(undefined); this.form.reset(); }
  search(event: Event) { if (event.target instanceof HTMLInputElement) this.searchChange.emit(event.target.value); }
  submit() {
    if (!this.canManage() || this.busy()) return;
    const raw = this.form.getRawValue();
    if (!raw.fullName.trim() || this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.action.emit({type: 'contact', id: this.editing(), value: {...raw, fullName: raw.fullName.trim(), email: raw.email.trim() || null, phone: raw.phone.trim() || null, title: raw.title.trim() || null, note: raw.note || null}});
  }
  assign() {
    const userId = this.selectedUser();
    if (userId && this.canManage() && !this.busy()) this.action.emit({type: 'assign', userId, note: this.assignmentNote()});
  }
}
