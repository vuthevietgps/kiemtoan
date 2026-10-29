import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzProgressModule } from 'ng-zorro-antd/progress';

/** Thẻ số liệu: tiêu đề, giá trị lớn, % so kỳ trước hoặc dòng phụ, thanh tiến độ tuỳ chọn. */
@Component({
  selector: 'app-kpi-card',
  imports: [NzIconModule, NzProgressModule, DecimalPipe],
  template: `
    <div class="kpi">
      <div class="head">
        <span class="icon" [style.background]="color() + '1a'" [style.color]="color()">
          <nz-icon [nzType]="icon()" />
        </span>
        <span class="label">{{ label() }}</span>
      </div>
      <div class="value">{{ value() }}</div>
      @if (change() !== undefined) {
        <div class="sub">
          @if (change() === null) {
            <span class="muted">Kỳ trước chưa có số liệu</span>
          } @else {
            <span [class.up]="change()! >= 0" [class.down]="change()! < 0">
              <nz-icon [nzType]="change()! >= 0 ? 'arrow-up' : 'arrow-down'" />
              {{ change()! | number: '1.0-1' }}%
            </span>
            <span class="muted">so với kỳ trước</span>
          }
        </div>
      }
      @if (hint()) {
        <div class="sub muted">{{ hint() }}</div>
      }
      @if (progress() !== undefined) {
        <nz-progress [nzPercent]="progress()!" nzSize="small" [nzStrokeColor]="color()" />
      }
    </div>
  `,
  styles: `
    .kpi {
      background: #fff;
      border-radius: 10px;
      padding: 16px;
      height: 100%;
      box-sizing: border-box;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      font-size: 18px;
    }
    .label {
      color: #4b5563;
      font-weight: 500;
    }
    .value {
      font-size: 24px;
      font-weight: 700;
      color: #0f2a4a;
      line-height: 1.3;
    }
    .sub {
      font-size: 13px;
      margin-top: 4px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .muted {
      color: #6b7280;
    }
    .up {
      color: #16a34a;
      font-weight: 600;
    }
    .down {
      color: #dc2626;
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly icon = input('bar-chart');
  readonly color = input('#1f5fbf');
  /** undefined = không hiện dòng so sánh; null = kỳ trước bằng 0. */
  readonly change = input<number | null | undefined>(undefined);
  readonly hint = input<string>();
  readonly progress = input<number | undefined>(undefined);
}
