import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzResultModule } from 'ng-zorro-antd/result';

/** Trang tạm cho chức năng chưa phát triển. */
@Component({
  selector: 'app-coming-soon',
  imports: [NzResultModule],
  template: `<nz-result nzStatus="info" [nzTitle]="title()" nzSubTitle="Chức năng đang được phát triển" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoonPage {
  readonly title = input('Đang phát triển');
}
