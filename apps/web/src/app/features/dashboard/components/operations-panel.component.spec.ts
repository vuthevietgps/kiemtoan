import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { provideNzI18n, vi_VN } from 'ng-zorro-antd/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import { APP_ICONS } from '../../../core/icons/app-icons';
import type { OperationsData } from '../data-access/dashboard.api';
import { OperationsPanelComponent } from './operations-panel.component';

registerLocaleData(localeVi);

const data = (cards: Partial<OperationsData['cards']> = {}): OperationsData => ({
  from: '2026-10-01',
  to: '2026-10-31',
  cards: {
    activeContracts: 3,
    openTasks: 12,
    overdueTasks: 2,
    waitingCustomer: 4,
    awaitingMyReview: 1,
    services: { done: 5, total: 20 },
    ...cards,
  },
  priorityTasks: [
    {
      id: 't1',
      title: 'Nộp tờ khai GTGT',
      customerName: 'Công ty A',
      assigneeName: 'Nhân viên B',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      statutory: true,
      dueDate: '2026-10-28',
      daysLeft: -2,
    },
  ],
  contractProgress: [
    {
      id: 'c1',
      code: 'HD-1',
      customerName: 'Công ty A',
      endDate: null,
      tasksDone: 3,
      tasksAll: 4,
      percent: 75,
    },
  ],
  deadlines: [
    {
      kind: 'OBLIGATION',
      id: 'o1',
      title: 'Tờ khai GTGT kỳ 2026-09',
      customerName: 'Công ty A',
      statutory: true,
      dueDate: '2026-11-02',
      daysLeft: 3,
    },
  ],
  notifications: {
    unread: 2,
    items: [
      {
        id: 'n1',
        title: 'Quá hạn: Nộp tờ khai',
        link: '/tasks?id=t1',
        severity: 'DANGER',
        createdAt: '2026-10-30T01:00:00Z',
      },
    ],
  },
});

describe('OperationsPanelComponent (10-B)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideNzI18n(vi_VN), provideNzIcons(APP_ICONS)],
    });
  });

  function render(value: OperationsData) {
    const fixture = TestBed.createComponent(OperationsPanelComponent);
    fixture.componentRef.setInput('data', value);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('M2–M3: 6 thẻ, bấm mở đúng danh sách có bộ lọc; thẻ dịch vụ mở danh sách ngay trên trang', () => {
    const { fixture, el } = render(data());
    const links = [...el.querySelectorAll<HTMLAnchorElement>('a.card')].map((a) =>
      decodeURIComponent(a.getAttribute('href') ?? ''),
    );
    expect(links).toEqual([
      '/contracts?status=IN_PROGRESS',
      '/tasks?card=remaining',
      '/tasks?card=overdue',
      '/tasks/documents?status=WAITING',
      '/tasks/my?tab=review',
    ]);
    let opened = 0;
    fixture.componentInstance.openServices.subscribe(() => opened++);
    el.querySelector<HTMLButtonElement>('button.card')!.click();
    expect(opened).toBe(1);
    expect(el.textContent).toContain('5/20');
  });

  it('không có quyền việc (null) → ẩn thẻ việc; danh sách ưu tiên, tiến độ, lịch hạn, thông báo hiện đủ', () => {
    const { el } = render(
      data({ openTasks: null, overdueTasks: null, waitingCustomer: null, awaitingMyReview: null }),
    );
    expect(el.querySelectorAll('.card')).toHaveLength(2);
    const text = el.textContent ?? '';
    expect(text).toContain('Nộp tờ khai GTGT');
    expect(text).toContain('Quá hạn 2 ngày');
    expect(text).toContain('Pháp lý');
    expect(text).toContain('3/4 việc hoàn thành');
    expect(text).toContain('Tờ khai GTGT kỳ 2026-09');
    expect(text).toContain('Quá hạn: Nộp tờ khai');
    const deadline = el.querySelectorAll<HTMLAnchorElement>('app-due-list a')[1];
    expect(decodeURIComponent(deadline.getAttribute('href') ?? '')).toBe('/deadlines?id=o1');
  });
});
