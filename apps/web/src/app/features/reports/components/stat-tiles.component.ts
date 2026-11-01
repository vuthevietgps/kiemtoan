import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface StatTile {
  /** null = ô chỉ hiển thị (không lọc). */
  key: string | null;
  label: string;
  value: number | string;
  color: string;
}

/**
 * Hàng ô tổng hợp của báo cáo (10, M3): bấm ô để lọc danh sách chi tiết bên dưới; bấm lại để bỏ lọc. Số
 * trên ô = số dòng của danh sách khi lọc.
 */
@Component({
  selector: 'app-stat-tiles',
  template: `
    <div class="tiles">
      @for (t of tiles(); track t.label) {
        @if (t.key === null) {
          <div class="tile static" [style.border-left-color]="t.color">
            <span>{{ t.label }}</span
            ><b>{{ t.value }}</b>
          </div>
        } @else {
          <button
            type="button"
            class="tile"
            [class.active]="active() === t.key"
            [style.border-left-color]="t.color"
            (click)="picked.emit(active() === t.key ? null : t.key)"
          >
            <span>{{ t.label }}</span
            ><b>{{ t.value }}</b>
          </button>
        }
      }
    </div>
  `,
  styles: `
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border: 1px solid #f0f0f0;
      border-left: 4px solid #8c8c8c;
      border-radius: 6px;
      background: #fff;
      text-align: left;
      font: inherit;
      cursor: pointer;
      min-width: 0;
      span {
        color: rgba(0, 0, 0, 0.55);
      }
      b {
        font-size: 18px;
      }
    }
    .tile.active {
      background: #e6f4ff;
      border-color: #91caff;
    }
    .tile.static {
      cursor: default;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatTilesComponent {
  readonly tiles = input.required<StatTile[]>();
  readonly active = input<string | null>(null);
  readonly picked = output<string | null>();
}
