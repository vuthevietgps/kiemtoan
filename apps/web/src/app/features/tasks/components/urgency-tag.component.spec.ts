import { TestBed } from '@angular/core/testing';
import { UrgencyTagComponent } from './urgency-tag.component';

describe('UrgencyTagComponent (06, I11)', () => {
  function render(urgency: string | null) {
    const fixture = TestBed.createComponent(UrgencyTagComponent);
    fixture.componentRef.setInput('urgency', urgency);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent?.trim() ?? '';
  }

  it('hiện nhãn theo bảng mốc PL1; Bình thường và việc đã xong không hiện', () => {
    expect(render('OVERDUE')).toBe('Quá hạn');
    expect(render('TODAY')).toBe('Đến hạn hôm nay');
    expect(render('NEAR')).toBe('Gần đến hạn');
    expect(render('PRIORITY')).toBe('Cần ưu tiên');
    expect(render('DUE_SOON')).toBe('Sắp đến hạn');
    expect(render('NORMAL')).toBe('');
    expect(render(null)).toBe('');
  });
});
