import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AuditEngagementView } from '../../data-access/audit-tracking.api';
import { AuditNotesComponent } from './audit-notes.component';

const ITEM = {
  lineId: 'line',
  engagement: {
    priority: 'URGENT',
    notes: [
      {
        id: 'n2',
        content: 'Khách hẹn gửi sổ phụ',
        author: { id: 's', fullName: 'Nhân viên' },
        createdAt: '2026-10-23T03:00:00Z',
      },
    ],
  },
  canPrioritize: false,
  canNote: true,
} as unknown as AuditEngagementView;

describe('AuditNotesComponent (04-F4)', () => {
  let fixture: ComponentFixture<AuditNotesComponent>;
  let text: () => string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AuditNotesComponent],
      providers: [provideNoopAnimations()],
    });
    fixture = TestBed.createComponent(AuditNotesComponent);
    fixture.componentRef.setInput('item', ITEM);
    fixture.detectChanges();
    text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  });

  it('không có quyền đổi mức độ thì hiện nhãn theo bảng LTGroup; hiện nhật ký tình hình', () => {
    expect(text()).toContain('Rất gấp');
    expect(text()).toContain('Khách hẹn gửi sổ phụ');
    expect(text()).toContain('Nhân viên');
  });

  it('thêm cập nhật: phát nội dung đã cắt khoảng trắng, chỉ xoá ô nhập khi lưu thành công', () => {
    const emitted: { content: string; saved: () => void }[] = [];
    fixture.componentInstance.addNote.subscribe((e) => emitted.push(e));
    const component = fixture.componentInstance as unknown as { draft: string; submit(): void };
    component.draft = '  Đã nhận đủ chứng từ  ';
    component.submit();
    expect(emitted[0].content).toBe('Đã nhận đủ chứng từ');
    expect(component.draft).toBe('  Đã nhận đủ chứng từ  ');
    emitted[0].saved();
    expect(component.draft).toBe('');
  });

  it('nội dung quá ngắn không gửi', () => {
    const emitted: unknown[] = [];
    fixture.componentInstance.addNote.subscribe((e) => emitted.push(e));
    const component = fixture.componentInstance as unknown as { draft: string; submit(): void };
    component.draft = ' x ';
    component.submit();
    expect(emitted).toEqual([]);
  });
});
