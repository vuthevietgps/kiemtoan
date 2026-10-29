import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../../core/api/api';
import {
  DocumentRequirement,
  ObligationTypeOption,
  ScheduleMode,
  WorkflowPreview,
  WorkflowsApi,
  WorkflowStep,
  WorkflowTemplate,
  WorkflowUserOption,
  WorkflowVersion,
} from './workflows.api';

/** Khoá bước mới chưa trùng: B01, B02… */
export function nextStepKey(steps: WorkflowStep[]): string {
  const used = new Set(steps.map((s) => s.key));
  for (let i = steps.length + 1; ; i++) {
    const key = `B${String(i).padStart(2, '0')}`;
    if (!used.has(key)) return key;
  }
}

/** Bỏ phụ thuộc trỏ tới bước đã xoá. */
export function withoutStep(steps: WorkflowStep[], key: string): WorkflowStep[] {
  return steps.filter((s) => s.key !== key).map((s) => ({ ...s, dependsOn: s.dependsOn.filter((d) => d !== key) }));
}

/**
 * Trạng thái trang quy trình: quy trình, phiên bản đang xem và bản sao các bước đang sửa.
 * Lưu gửi kèm revision; lỗi 409 hiển thị để người dùng tải lại, không ghi đè.
 */
@Injectable()
export class WorkflowEditorStore {
  private readonly api = inject(WorkflowsApi);
  readonly template = signal<WorkflowTemplate | null>(null);
  readonly version = signal<WorkflowVersion | null>(null);
  readonly steps = signal<WorkflowStep[]>([]);
  readonly requirements = signal<DocumentRequirement[]>([]);
  readonly scheduleMode = signal<ScheduleMode>('PERIODIC');
  readonly note = signal('');
  readonly dirty = signal(false);
  readonly preview = signal<WorkflowPreview | null>(null);
  readonly users = signal<WorkflowUserOption[]>([]);
  readonly obligationTypes = signal<ObligationTypeOption[]>([]);
  readonly userNames = computed(() => new Map(this.users().map((u) => [u.id, u.fullName])));
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly editable = computed(() => this.version()?.status === 'DRAFT');

  async load(templateId: string, versionId?: string | null): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      if (this.users().length === 0) void this.loadUsers();
      if (this.obligationTypes().length === 0) void this.loadObligationTypes();
      const template = await firstValueFrom(this.api.template(templateId));
      this.template.set(template);
      const id = versionId ?? template.draftVersion?.id ?? template.activeVersion?.id ?? template.versions[0]?.id;
      if (id) this.setVersion(await firstValueFrom(this.api.version(id)));
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  /** Danh sách người chọn làm mặc định; lỗi thì để trống, không chặn trang. */
  private async loadUsers(): Promise<void> {
    try {
      this.users.set(await firstValueFrom(this.api.userOptions()));
    } catch {
      this.users.set([]);
    }
  }

  /** Loại nghĩa vụ để gắn bước pháp lý (06); không có quyền/lỗi thì để trống. */
  private async loadObligationTypes(): Promise<void> {
    try {
      this.obligationTypes.set(await firstValueFrom(this.api.obligationTypes()));
    } catch {
      this.obligationTypes.set([]);
    }
  }

  async selectVersion(id: string): Promise<void> {
    await this.run(this.api.version(id), (v) => this.setVersion(v));
  }

  setSteps(steps: WorkflowStep[]): void {
    this.steps.set(steps);
    this.dirty.set(true);
  }

  setRequirements(requirements: DocumentRequirement[]): void {
    this.requirements.set(requirements);
    this.dirty.set(true);
  }

  setScheduleMode(mode: ScheduleMode): void {
    this.scheduleMode.set(mode);
    this.dirty.set(true);
  }

  setNote(note: string): void {
    this.note.set(note);
    this.dirty.set(true);
  }

  save(): Promise<boolean> {
    const version = this.version();
    if (!version) return Promise.resolve(false);
    const steps = this.steps().map((s) => ({
      key: s.key, phase: s.phase, name: s.name, instructions: s.instructions, required: s.required,
      durationDays: s.durationDays, dueOffsetDays: s.dueOffsetDays, performerRole: s.performerRole,
      defaultAssigneeId: s.defaultAssigneeId, reviewLevels: s.reviewLevels, reviewerRole: s.reviewerRole,
      defaultReviewerId: s.defaultReviewerId, defaultApproverId: s.defaultApproverId,
      requiresEvidence: s.requiresEvidence, evidenceHint: s.evidenceHint, dependsOn: s.dependsOn,
      // Cờ hạn pháp lý/giao nộp (05-B) và loại nghĩa vụ (06): thiếu thì API coi là tắt.
      isStatutory: s.isStatutory ?? false, requiresDelivery: s.requiresDelivery ?? false,
      obligationTypeId: s.isStatutory ? (s.obligationTypeId ?? null) : null,
    }));
    const requirements = this.requirements().map((r) => ({
      name: r.name, instructions: r.instructions, required: r.required, category: r.category, perPeriod: r.perPeriod, stepKey: r.stepKey,
    }));
    const body = { revision: version.revision, scheduleMode: this.scheduleMode(), note: this.note().trim() || null, steps, requirements };
    return this.run(this.api.save(version.id, body), (v) => this.setVersion(v));
  }

  async publish(): Promise<boolean> {
    const version = this.version();
    if (!version || (this.dirty() && !(await this.save()))) return false;
    return this.run(this.api.publish(version.id), (v) => this.afterChange(v));
  }

  cloneToDraft(): Promise<boolean> {
    const version = this.version();
    return version ? this.run(this.api.clone(version.id), (v) => this.afterChange(v)) : Promise.resolve(false);
  }

  async removeDraft(): Promise<boolean> {
    const version = this.version();
    const template = this.template();
    if (!version || !template) return false;
    return this.run(this.api.remove(version.id), () => this.load(template.id));
  }

  setDefault(): Promise<boolean> {
    const template = this.template();
    return template ? this.run(this.api.updateTemplate(template.id, { isDefault: true }), (t) => this.template.set(t)) : Promise.resolve(false);
  }

  loadPreview(startDate: string | null, period: string | null): Promise<boolean> {
    const version = this.version();
    return version ? this.run(this.api.preview(version.id, startDate, period), (p) => this.preview.set(p)) : Promise.resolve(false);
  }

  private async afterChange(version: WorkflowVersion): Promise<void> {
    this.setVersion(version);
    this.template.set(await firstValueFrom(this.api.template(version.template.id)));
  }

  private setVersion(version: WorkflowVersion): void {
    this.version.set(version);
    this.steps.set(version.steps.map((s) => ({ ...s, dependsOn: [...s.dependsOn] })));
    this.requirements.set(version.requirements.map((r) => ({ ...r })));
    this.scheduleMode.set(version.scheduleMode);
    this.note.set(version.note ?? '');
    this.preview.set(null);
    this.dirty.set(false);
  }

  private async run<T>(action: Observable<T>, then: (value: T) => void | Promise<void>): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    try {
      await then(await firstValueFrom(action));
      return true;
    } catch (err) {
      this.error.set(errorMessage(err));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
