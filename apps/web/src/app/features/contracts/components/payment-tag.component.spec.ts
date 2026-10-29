import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { ContractStatus, PaymentStatus } from '../contract-labels';
import { PaymentTagComponent } from './payment-tag.component';

function render(status: PaymentStatus, contractStatus: ContractStatus, paid: string) {
  const fixture = TestBed.createComponent(PaymentTagComponent);
  fixture.componentRef.setInput('status', status);
  fixture.componentRef.setInput('contractStatus', contractStatus);
  fixture.componentRef.setInput('total', '165000000');
  fixture.componentRef.setInput('paid', paid);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).textContent?.trim();
}

describe('PaymentTagComponent', () => {
  it('07-D2: còn nợ quá hạn hiện số còn nợ, kể cả HĐ đang thực hiện chưa thu đồng nào', () => {
    expect(render('OVERDUE', 'IN_PROGRESS', '0')).toBe('Còn nợ quá hạn 165 tr');
  });

  it('giữ cách hiện cũ cho thu một phần / chưa thanh toán', () => {
    expect(render('PARTIAL', 'IN_PROGRESS', '15000000')).toBe('Đã thu 15 tr');
    expect(render('UNPAID', 'IN_PROGRESS', '0')).toBe('Chưa thanh toán');
  });
});
