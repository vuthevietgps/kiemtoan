import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Tiêu đề trang + vùng nút bên phải: <app-page-header title="Khách hàng"><button>…</button></app-page-header> */
@Component({
  selector: 'app-page-header',
  template: `
    <div class="page-header">
      <div>
        <h2>{{ title() }}</h2>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .page-header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    h2 { margin: 0; font-size: 20px; color: #0f2a4a; }
    p { margin: 2px 0 0; color: #6b7280; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
