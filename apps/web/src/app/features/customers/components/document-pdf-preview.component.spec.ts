import { TestBed } from '@angular/core/testing';
import { DocumentPdfPreviewComponent } from './document-pdf-preview.component';

const pdf = vi.hoisted(() => ({getDocument: vi.fn()}));
vi.mock('pdfjs-dist', () => ({getDocument: pdf.getDocument, GlobalWorkerOptions: {workerSrc: ''}}));

describe('PDF document preview', () => {
  it('renders one bounded page and offers navigation without relying on a browser plugin', async () => {
    const render = vi.fn(() => ({promise: Promise.resolve(), cancel: vi.fn()}));
    pdf.getDocument.mockReturnValue({promise: Promise.resolve({numPages: 2, getPage: vi.fn(async () => ({getViewport: () => ({width: 200, height: 300}), render}))}), destroy: vi.fn(async () => {})});
    const fixture = TestBed.createComponent(DocumentPdfPreviewComponent);
    fixture.componentRef.setInput('blob',new Blob(['synthetic fixture'],{type:'application/pdf'}));
    fixture.detectChanges();
    await vi.waitFor(() => { fixture.detectChanges(); expect(render).toHaveBeenCalledTimes(1); });
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(200); expect(canvas.height).toBe(300);
    expect(fixture.nativeElement.textContent).toContain('1 / 2');
    expect(pdf.getDocument).toHaveBeenCalledWith(expect.objectContaining({enableXfa:false, maxImageSize:16_000_000}));
  });
  it('shows an actionable error for unreadable PDFs', async () => {
    pdf.getDocument.mockImplementation(() => ({promise: Promise.reject(new Error('Invalid PDF')), destroy: vi.fn(async () => {})}));
    const fixture = TestBed.createComponent(DocumentPdfPreviewComponent);
    fixture.componentRef.setInput('blob',new Blob(['bad'],{type:'application/pdf'})); fixture.detectChanges();
    await vi.waitFor(() => { fixture.detectChanges(); expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Không xem trước được PDF'); });
  });
});
