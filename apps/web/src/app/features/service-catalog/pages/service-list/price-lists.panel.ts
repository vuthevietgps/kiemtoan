import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { moneyFormatter } from '../../../contracts/form-utils';
import { PriceListFormComponent } from '../../components/price-list-form/price-list-form.component';
import { PriceList, PriceListInput, PriceTier, ServiceType } from '../../data-access/service-catalog.api';
import { PriceListsStore } from '../../data-access/service-catalog.store';
import { PRICE_LIST_STATUS, SERVICE_CATALOG_TEXT } from '../../service-catalog.text';

/** Danh sách bảng giá của một dịch vụ và form thêm/sửa bảng sắp áp dụng. */
@Component({
  selector: 'app-price-lists-panel',
  imports: [
    DatePipe,
    NzAlertModule,
    NzButtonModule,
    NzIconModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
    CanDirective,
    VndPipe,
    PriceListFormComponent,
  ],
  templateUrl: './price-lists.panel.html',
  providers: [PriceListsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceListsPanel {
  readonly service = input.required<ServiceType>();

  protected readonly store = inject(PriceListsStore);
  private readonly message = inject(NzMessageService);
  protected readonly text = SERVICE_CATALOG_TEXT;
  protected readonly statusLabels = PRICE_LIST_STATUS;
  /** null = đang xem danh sách; 'new' = tạo mới; PriceList = sửa bảng sắp áp dụng. */
  protected readonly editing = signal<PriceList | 'new' | null>(null);

  constructor() {
    effect(() => {
      void this.store.load(this.service().id);
    });
  }

  protected tierLabel(tier: PriceTier, list: PriceList): string {
    if (list.pricingBasis === 'NONE') return this.text.flatPrice;
    const from = moneyFormatter(Number(tier.minValue));
    return tier.maxValue === null
      ? `≥ ${from}`
      : `${from} – < ${moneyFormatter(Number(tier.maxValue))}`;
  }

  protected editedList(): PriceList | null {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  }

  protected async save(input: PriceListInput): Promise<void> {
    const editing = this.editing();
    const id = editing && editing !== 'new' ? editing.id : null;
    if (await this.store.save(this.service().id, id, input)) {
      this.message.success(this.text.priceListSaved);
      this.editing.set(null);
    }
  }

  protected async remove(list: PriceList): Promise<void> {
    if (await this.store.remove(this.service().id, list.id)) this.message.success(this.text.removed);
  }
}
