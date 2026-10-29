import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../../../core/auth/auth.service';
import { ServiceCatalogApi } from '../../service-catalog/data-access/service-catalog.api';
import { TasksApi } from '../../tasks/data-access/tasks.api';
import { ObligationRuleFormComponent } from '../components/obligation-rule-form.component';
import { ObligationTypeDetailComponent } from '../components/obligation-type-detail.component';
import type { CreateTypeInput, RuleInput, SyncSummary } from '../data-access/deadline-settings.api';
import { ObligationTypesStore } from '../data-access/obligation-types.store';
import { CYCLE_LABELS, GROUP_LABELS, SETTINGS_TEXT } from '../deadline-settings.text';

/** Tab "Loại nghĩa vụ" (I1, I4): danh mục, tạo mới, chi tiết trong ngăn bên phải. */
@Component({
  selector: 'app-obligation-types-panel',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzTableModule,
    NzTagModule,
    ObligationRuleFormComponent,
    ObligationTypeDetailComponent,
  ],
  providers: [ObligationTypesStore],
  templateUrl: './obligation-types.panel.html',
  styleUrl: './obligation-types.panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObligationTypesPanel implements OnInit {
  protected readonly store = inject(ObligationTypesStore);
  private readonly auth = inject(AuthService);
  private readonly message = inject(NzMessageService);
  private readonly catalog = inject(ServiceCatalogApi);
  private readonly tasksApi = inject(TasksApi);

  protected readonly text = SETTINGS_TEXT;
  protected readonly groups = GROUP_LABELS;
  protected readonly cycles = CYCLE_LABELS;
  protected readonly canCreate = computed(() => this.auth.can('deadlines:create'));
  protected readonly canApprove = computed(() => this.auth.can('deadlines:approve'));
  protected readonly creating = signal(false);
  protected readonly services = signal<{ id: string; label: string }[]>([]);
  protected readonly customers = signal<{ id: string; label: string }[]>([]);
  protected readonly width = computed(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : 620,
  );

  ngOnInit(): void {
    void this.store.load();
    void this.loadOptions();
  }

  protected confirmedNo(versions: { status: string; versionNo: number }[]): number | null {
    return versions.find((v) => v.status === 'CONFIRMED')?.versionNo ?? null;
  }

  protected hasDraft(versions: { status: string }[]): boolean {
    return versions.some((v) => v.status === 'DRAFT');
  }

  protected async create(input: CreateTypeInput): Promise<void> {
    const created = await this.store.create(input);
    if (!created) return;
    this.creating.set(false);
    this.store.select(created.id);
    this.message.success(this.text.saved);
  }

  protected async saveDraft(id: string, event: { rule: RuleInput; revision?: number }) {
    if (await this.store.saveDraft(id, event.rule, event.revision))
      this.message.success(this.text.saved);
  }

  protected async confirm(id: string, revision: number): Promise<void> {
    const result = await this.store.confirm(id, revision);
    if (result) this.notifySync(result.synced, result.changedDues);
  }

  protected async retire(id: string, reason: string): Promise<void> {
    const result = await this.store.retire(id, reason);
    if (result) this.notifySync(result.synced, 0);
  }

  protected async saveServices(id: string, ids: string[]): Promise<void> {
    const result = await this.store.setServices(id, ids);
    if (result) this.notifySync(result.synced, 0);
  }

  private notifySync(synced: SyncSummary, changed: number): void {
    this.message.success(this.text.synced(synced.created + synced.revived, synced.retired, changed));
  }

  private async loadOptions(): Promise<void> {
    const [services, customers] = await Promise.allSettled([
      firstValueFrom(this.catalog.list()),
      firstValueFrom(this.tasksApi.customerOptions()),
    ]);
    if (services.status === 'fulfilled')
      this.services.set(services.value.map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` })));
    if (customers.status === 'fulfilled')
      this.customers.set(
        customers.value.map((c) => ({ id: c.id, label: `${c.name} (${c.taxCode})` })),
      );
  }
}
