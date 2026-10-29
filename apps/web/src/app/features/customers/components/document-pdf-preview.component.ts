import { ChangeDetectionStrategy, Component, effect, ElementRef, input, OnDestroy, signal, viewChild } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { DOCUMENTS_TEXT } from '../documents.text';

@Component({
  selector: 'app-document-pdf-preview',
  imports: [NzButtonModule],
  templateUrl: './document-pdf-preview.component.html',
  styleUrl: './document-pdf-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentPdfPreviewComponent implements OnDestroy {
  readonly blob = input.required<Blob>();
  protected readonly text = DOCUMENTS_TEXT;
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly page = signal(1);
  protected readonly pageCount = signal(0);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private pdf: PDFDocumentProxy | null = null;
  private task: PDFDocumentLoadingTask | null = null;
  private rendering: RenderTask | null = null;
  private generation = 0;

  constructor() { effect(() => { const blob = this.blob(); if (this.canvas()) void this.load(blob); }); }
  private async load(blob: Blob) {
    const generation = ++this.generation;
    await this.dispose(); this.loading.set(true); this.error.set(''); this.pageCount.set(0);
    try {
      const [library, data] = await Promise.all([import('pdfjs-dist'), blob.arrayBuffer()]);
      if (generation !== this.generation) return;
      library.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.min.mjs';
      const task = library.getDocument({data: new Uint8Array(data), cMapUrl: '/assets/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/assets/pdfjs/standard_fonts/', wasmUrl: '/assets/pdfjs/wasm/', enableXfa: false, maxImageSize: 16_000_000, stopAtErrors: true});
      this.task = task;
      const pdf = await task.promise;
      if (generation !== this.generation) { await task.destroy(); return; }
      this.pdf = pdf; this.pageCount.set(pdf.numPages); await this.renderPage(1);
    } catch { if (generation === this.generation) this.error.set(this.text.previewError); }
    finally { if (generation === this.generation) this.loading.set(false); }
  }
  protected async navigate(page: number) {
    if (this.loading() || page < 1 || page > this.pageCount()) return;
    this.loading.set(true);
    try { await this.renderPage(page); }
    catch { this.error.set(this.text.previewError); }
    finally { this.loading.set(false); }
  }
  private async renderPage(pageNumber: number) {
    const canvas = this.canvas()?.nativeElement;
    if (!this.pdf || !canvas) return;
    const page = await this.pdf.getPage(pageNumber);
    const natural = page.getViewport({scale: 1});
    const scale = Math.min(1.5, 1200 / natural.width, 1600 / natural.height);
    const viewport = page.getViewport({scale});
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    this.rendering = page.render({canvas, viewport}); await this.rendering.promise;
    this.page.set(pageNumber); this.rendering = null;
  }
  private async dispose() {
    this.rendering?.cancel(); this.rendering = null;
    try { await this.task?.destroy(); } catch { /* A cancelled render has no user-visible error. */ }
    this.task = null; this.pdf = null;
  }
  ngOnDestroy() { this.generation++; void this.dispose(); }
}
