import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { CREDENTIAL_STATUS_LABELS } from '../../customers/customer-labels';
import { CREDENTIALS_TEXT, EVENT_LABELS, FIELD_LABELS } from '../client-credentials.text';
import type { CredentialEvent } from '../data-access/client-credentials.api';

/** Dòng thời gian lịch sử / nhật ký xem – sao chép của một tài khoản (09-D, L5–L8). Không có bí mật. */
@Component({
  selector: 'app-credential-timeline',
  imports: [DatePipe, NzTimelineModule],
  template: `
    @if (events().length) {
      <nz-timeline>
        @for (e of events(); track e.id) {
          <nz-timeline-item>
            <div>
              <strong>{{ labels[e.type] }}</strong>
              <span class="muted">
                · {{ e.occurredAt | date: 'dd/MM/yyyy HH:mm' }} · {{ actorOf(e) }}</span
              >
            </div>
            @if (describe(e); as more) {
              <div>{{ more }}</div>
            }
            @if (e.note) {
              <div class="pre">{{ e.note }}</div>
            }
          </nz-timeline-item>
        }
      </nz-timeline>
    } @else {
      <p class="muted">{{ empty() }}</p>
    }
  `,
  styles: `
    .muted {
      color: rgba(0, 0, 0, 0.5);
    }
    .pre {
      white-space: pre-wrap;
      word-break: break-word;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialTimelineComponent {
  readonly events = input<CredentialEvent[]>([]);
  readonly empty = input('');

  protected readonly labels = EVENT_LABELS;
  private readonly text = CREDENTIALS_TEXT;

  /** Dòng mô tả thêm: trường đã sửa, trạng thái mới, người nhận và hạn trả. */
  protected describe(e: CredentialEvent): string {
    const d = e.detail ?? {};
    if (e.type === 'UPDATED' && Array.isArray(d['fields']))
      return `${(d['fields'] as string[]).map((f) => FIELD_LABELS[f] ?? f).join(', ')}`;
    if (e.type === 'STATUS_CHANGED' || e.type === 'STATUS_REPORTED') {
      const to = d['to'] as keyof typeof CREDENTIAL_STATUS_LABELS | undefined;
      return to ? `→ ${CREDENTIAL_STATUS_LABELS[to]}` : '';
    }
    const holder = d['holder'] as { fullName?: string } | undefined;
    const due = d['dueDate'] as string | undefined;
    if (holder?.fullName)
      return `${holder.fullName}${due ? ` · hạn trả ${due.split('-').reverse().join('/')}` : ''}`;
    return '';
  }

  protected actorOf(e: CredentialEvent): string {
    if (e.actor) return e.actor.fullName;
    return e.detail?.['migrated'] ? this.text.migrated : this.text.system;
  }
}
