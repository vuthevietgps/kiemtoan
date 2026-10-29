import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserFormModalComponent } from './user-form-modal.component';
import type { User } from '../data-access/users.api';

let fixture: ComponentFixture<UserFormModalComponent>;
let component: UserFormModalComponent;
beforeEach(async () => {
  await TestBed.configureTestingModule({ imports: [UserFormModalComponent] }).overrideComponent(UserFormModalComponent, { set: { template: '', imports: [] } }).compileComponents();
  fixture = TestBed.createComponent(UserFormModalComponent); component = fixture.componentInstance;
  fixture.componentRef.setInput('open', true); fixture.detectChanges();
});
describe('User form submission rules', () => {
  it('creates an invitation without sending a blank password', () => {
    const emit = vi.spyOn(component.submitted, 'emit');
    component['form'].patchValue({ fullName: 'New user', email: 'user@test.vn' }); component['submit']();
    expect(emit).toHaveBeenCalledOnce(); expect(emit.mock.calls[0][0]).not.toHaveProperty('password');
  });
  it('rejects a weak initial password and blocks duplicate submissions while saving', () => {
    const emit = vi.spyOn(component.submitted, 'emit');
    component['form'].patchValue({ fullName: 'New user', email: 'user@test.vn', password: 'weakpassword' }); component['submit'](); expect(emit).not.toHaveBeenCalled();
    component['form'].controls.password.setValue('NewStrong@123'); fixture.componentRef.setInput('busy', true); fixture.detectChanges(); component['submit'](); expect(emit).not.toHaveBeenCalled();
  });
  it('disables privilege changes for the current account and never sends an email/password edit', () => {
    const user = { id: 'self', fullName: 'Admin', email: 'admin@test.vn', role: 'ADMIN', teamId: null, title: null, phone: null, accessRoleId: null, financialAccess: null, secretAccess: null } as User;
    fixture.componentRef.setInput('user', user); fixture.componentRef.setInput('currentUserId', 'self'); fixture.detectChanges();
    expect(component['form'].controls.role.disabled).toBe(true); expect(component['form'].controls.financialAccess.disabled).toBe(true);
    const emit = vi.spyOn(component.submitted, 'emit'); component['submit']();
    expect(emit.mock.calls[0][0]).not.toHaveProperty('email'); expect(emit.mock.calls[0][0]).not.toHaveProperty('password');
  });
});
