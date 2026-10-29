import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { AuthService } from '../../../core/auth/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { SETTINGS_TEXT } from '../deadline-settings.text';
import { BusinessCalendarPanel } from './business-calendar.panel';
import { DeliveriesPanel } from './deliveries.panel';
import { ObligationTypesPanel } from './obligation-types.panel';
import { ReminderSettingsPanel } from './reminder-settings.panel';

/**
 * Cấu hình 06 (06-D3): loại nghĩa vụ và lịch năm cho người có `deadlines:view` (soạn/xác nhận theo
 * create/approve); nhắc việc và nhật ký gửi cho người có `settings:view`. Tab tải khi mở.
 */
@Component({
  selector: 'app-deadline-settings-page',
  imports: [
    NzTabsModule,
    PageHeaderComponent,
    ObligationTypesPanel,
    BusinessCalendarPanel,
    ReminderSettingsPanel,
    DeliveriesPanel,
  ],
  template: `
    <app-page-header [title]="text.title" [subtitle]="text.subtitle" />
    <div class="panel">
      <nz-tabs>
        @if (canDeadlines()) {
          <nz-tab [nzTitle]="text.tabTypes">
            <ng-template nz-tab><app-obligation-types-panel /></ng-template>
          </nz-tab>
          <nz-tab [nzTitle]="text.tabCalendar">
            <ng-template nz-tab><app-business-calendar-panel /></ng-template>
          </nz-tab>
        }
        @if (canSettings()) {
          <nz-tab [nzTitle]="text.tabReminders">
            <ng-template nz-tab><app-reminder-settings-panel /></ng-template>
          </nz-tab>
          <nz-tab [nzTitle]="text.tabDeliveries">
            <ng-template nz-tab><app-deliveries-panel /></ng-template>
          </nz-tab>
        }
      </nz-tabs>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadlineSettingsPage {
  private readonly auth = inject(AuthService);
  protected readonly text = SETTINGS_TEXT;
  protected readonly canDeadlines = computed(() => this.auth.can('deadlines:view'));
  protected readonly canSettings = computed(() => this.auth.can('settings:view'));
}
