import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzMessageService } from 'ng-zorro-antd/message';
import { errorMessage } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { ObligationDrawerComponent } from '../components/obligation-drawer.component';
import {
  ObligationSettingsComponent,
  SettingChange,
} from '../components/obligation-settings.component';
import { ObligationTableComponent } from '../components/obligation-table.component';
import { ObligationAction, ObligationsStore } from '../data-access/obligations.store';
import { DEADLINES_TEXT } from '../deadlines.text';
import { saveFile } from '../save-file';

/** Tab "Lịch báo cáo" ở chi tiết KH (06-D2): loại báo cáo áp dụng (bật/tắt riêng) và nghĩa vụ của KH. */
@Component({
  selector: 'app-customer-obligations-panel',
  imports: [
    NzAlertModule,
    ObligationSettingsComponent,
    ObligationTableComponent,
    ObligationDrawerComponent,
  ],
  providers: [ObligationsStore],
  templateUrl: './customer-obligations.panel.html',
  styles: `
    .notice,
    .settings {
      display: block;
      margin-bottom: 16px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerObligationsPanel implements OnInit {
  readonly customerId = input.required<string>();
  protected readonly store = inject(ObligationsStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  protected readonly canUpdate = computed(() => this.auth.can('deadlines:update'));
  protected readonly canApprove = computed(() => this.auth.can('deadlines:approve'));

  ngOnInit(): void {
    this.store.setQuery({ customerId: this.customerId(), pageSize: 10 });
    void this.store.loadSettings(this.customerId());
  }

  protected async changeSetting(change: SettingChange): Promise<void> {
    const result = await this.store.setSetting(
      this.customerId(),
      change.typeId,
      change.enabled,
      change.reason,
    );
    if (result)
      this.message.success(
        DEADLINES_TEXT.synced(result.synced.created + result.synced.revived, result.synced.retired),
      );
  }

  protected async act(action: ObligationAction): Promise<void> {
    if (await this.store.act(action)) this.message.success(DEADLINES_TEXT.done);
  }

  protected openTask(id: string): void {
    void this.router.navigate(['/tasks'], { queryParams: { id } });
  }

  protected async download(doc: { id: string; fileName: string }): Promise<void> {
    try {
      saveFile(await firstValueFrom(this.store.downloadReceipt(doc.id)), doc.fileName);
    } catch (err) {
      this.message.error(errorMessage(err));
    }
  }
}
