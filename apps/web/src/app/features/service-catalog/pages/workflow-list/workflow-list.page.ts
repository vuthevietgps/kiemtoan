import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent } from '../../../../shared/components/page-header.component';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { ServiceCatalogApi, ServiceType } from '../../data-access/service-catalog.api';
import { WorkflowListStore } from '../../data-access/workflow-list.store';
import { WORKFLOW_TEXT } from '../../workflow.text';

@Component({
  selector: 'app-workflow-list-page',
  imports: [
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    CanDirective,
  ],
  templateUrl: './workflow-list.page.html',
  providers: [WorkflowListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowListPage implements OnInit {
  protected readonly store = inject(WorkflowListStore);
  private readonly catalog = inject(ServiceCatalogApi);
  private readonly router = inject(Router);
  protected readonly text = WORKFLOW_TEXT;
  protected readonly services = signal<ServiceType[]>([]);
  protected readonly createVisible = signal(false);
  protected search = '';
  protected newService = '';
  protected newName = '';

  async ngOnInit(): Promise<void> {
    void this.store.load();
    try {
      this.services.set(await firstValueFrom(this.catalog.list({ active: 'true' })));
    } catch {
      this.services.set([]);
    }
  }

  protected openCreate(): void {
    this.newService = this.store.filter().serviceTypeId;
    this.newName = '';
    this.createVisible.set(true);
  }

  protected async create(): Promise<void> {
    if (!this.newService || this.newName.trim().length < 2) return;
    const created = await this.store.create({ serviceTypeId: this.newService, name: this.newName.trim() });
    if (created) {
      this.createVisible.set(false);
      await this.router.navigate(['/service-catalog/workflows', created.id]);
    }
  }
}
