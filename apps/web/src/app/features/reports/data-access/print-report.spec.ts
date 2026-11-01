import { describe, expect, it } from 'vitest';
import { printHtml, vnDate } from './print-report';

describe('printHtml (10, M10)', () => {
  it('bản in có tiêu đề, kỳ dd/mm/yyyy, người in, ô tổng hợp, bảng; thoát ký tự HTML', () => {
    const html = printHtml(
      {
        title: 'Báo cáo hợp đồng',
        period: { from: '2026-01-01', to: '2026-12-31' },
        printedBy: 'Trần Văn Minh',
        summary: [['Mới duyệt', 2]],
        headers: ['Mã HĐ', 'Khách hàng'],
        rows: [['HD-1', 'Công ty <A> & "B"']],
      },
      new Date('2026-10-30T03:00:00Z'),
    );
    expect(html).toContain('<h1>Báo cáo hợp đồng</h1>');
    expect(html).toContain('Kỳ 01/01/2026 – 31/12/2026');
    expect(html).toContain('Người in: Trần Văn Minh');
    expect(html).toContain('<span>Mới duyệt</span><b>2</b>');
    expect(html).toContain('<td>Công ty &lt;A&gt; &amp; &quot;B&quot;</td>');
    expect(html).not.toContain('<A>');
  });

  it('vnDate: rỗng → chuỗi rỗng', () => {
    expect(vnDate('2026-03-05')).toBe('05/03/2026');
    expect(vnDate(null)).toBe('');
  });
});
