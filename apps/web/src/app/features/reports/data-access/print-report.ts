/**
 * Bản in báo cáo (10, M10): mở cửa sổ in riêng — tiêu đề, kỳ, ngày in, người in, các ô tổng hợp và bảng —
 * để người dùng in hoặc "Lưu thành PDF" từ trình duyệt. Không cần thư viện tạo PDF.
 */
export interface PrintableReport {
  title: string;
  period: { from: string; to: string };
  printedBy: string;
  summary: [string, string | number][];
  headers: string[];
  rows: (string | number)[][];
}

const escape = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const vnDate = (d: string | null) =>
  d ? d.slice(0, 10).split('-').reverse().join('/') : '';

/** HTML đầy đủ của bản in (tách riêng để kiểm thử). */
export function printHtml(r: PrintableReport, now = new Date()): string {
  const summary = r.summary
    .map(
      ([label, value]) =>
        `<div class="s"><span>${escape(label)}</span><b>${escape(value)}</b></div>`,
    )
    .join('');
  const head = r.headers.map((h) => `<th>${escape(h)}</th>`).join('');
  const body = r.rows
    .map((row) => `<tr>${row.map((c) => `<td>${escape(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escape(r.title)}</title>
<style>
body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}
h1{font-size:18px;margin:0 0 4px}.meta{color:#555;margin-bottom:12px}
.sum{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.s{border:1px solid #ccc;border-radius:4px;padding:6px 10px}.s span{display:block;color:#555}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
th{background:#f2f2f2}@page{size:A4 landscape;margin:12mm}
</style></head><body>
<h1>${escape(r.title)}</h1>
<div class="meta">Kỳ ${vnDate(r.period.from)} – ${vnDate(r.period.to)} · In lúc ${now.toLocaleString('vi-VN')} · Người in: ${escape(r.printedBy)}</div>
<div class="sum">${summary}</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
}

/** Mở cửa sổ in; trình duyệt chặn cửa sổ bật lên → trả false để báo người dùng. */
export function printReport(r: PrintableReport): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(printHtml(r));
  win.document.close();
  win.focus();
  win.print();
  return true;
}
