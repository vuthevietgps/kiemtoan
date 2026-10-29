import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditEngagementView, ContractDossier } from '../../data-access/audit-tracking.api';
import { rateColor } from '../../pages/audit-tracking/audit-people.panel';
import { ContractDossierCardComponent } from '../contract-dossier-card/contract-dossier-card.component';
import { AuditEngagementCardComponent } from './audit-engagement-card.component';

const ITEM: AuditEngagementView = {
  lineId: 'line',
  serviceType: { id: 'kt', code: 'KT', name: 'Kiểm toán' },
  period: '2025',
  description: null,
  year: 2025,
  engagement: {
    id: 'e1',
    stage: 'NOT_STARTED',
    priority: 'NORMAL',
    revision: 2,
    manager: { id: 'm', fullName: 'Manager' },
    lead: { id: 'old', fullName: 'Đã nghỉ', active: false },
    signer1: null,
    signer2: null,
    assistants: [{ id: 'a', fullName: 'Trợ lý' }],
    reportNumber: null,
    reportDate: null,
    reportDocumentId: null,
    issuedAt: null,
    issuedBy: null,
    deadlinesLocked: false,
    deadlines: [],
    suggestedIssueDue: '2026-03-31',
    timeline: [],
    notes: [],
  },
  unassigned: [],
  canEdit: true,
  canIssue: true,
  canExtend: false,
  canPrioritize: true,
  canNote: true,
};

describe('AuditEngagementCardComponent', () => {
  let fixture: ComponentFixture<AuditEngagementCardComponent>;
  let card: AuditEngagementCardComponent;
  let emitted: unknown[];

  const setItem = (patch: Partial<AuditEngagementView['engagement']>) => {
    fixture.componentRef.setInput('item', {
      ...ITEM,
      engagement: { ...ITEM.engagement, ...patch },
    });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AuditEngagementCardComponent] })
      .overrideComponent(AuditEngagementCardComponent, { set: { template: '', imports: [] } })
      .compileComponents();
    fixture = TestBed.createComponent(AuditEngagementCardComponent);
    card = fixture.componentInstance;
    fixture.componentRef.setInput('users', [{ id: 'm', fullName: 'Manager', role: 'MANAGER' }]);
    emitted = [];
    card.saveTeam.subscribe((v) => emitted.push(v));
    card.changeStage.subscribe((v) => emitted.push(v));
    card.issueReport.subscribe((v) => emitted.push(v));
    setItem({});
  });

  it('gửi nhóm kèm hạn khi chưa chốt, dùng gợi ý hạn phát hành từ kế hoạch', () => {
    card['useSuggestion']();
    card['submitTeam']();
    expect(emitted[0]).toEqual({
      revision: 2,
      managerId: 'm',
      leadId: 'old',
      signer1Id: null,
      signer2Id: null,
      assistantIds: ['a'],
      fieldworkDue: null,
      reviewDue: null,
      issueDue: '2026-03-31',
    });
    // Người đang giữ vai nhưng đã nghỉ vẫn có trong danh sách chọn để không mất tên.
    expect(card['options']().map((o) => o.id)).toEqual(['m', 'old', 'a']);
  });

  it('không gửi hạn sau khi đã chốt (đổi hạn phải gia hạn)', () => {
    setItem({ deadlinesLocked: true, stage: 'FIELDWORK' });
    card['submitTeam']();
    expect(emitted[0]).not.toHaveProperty('issueDue');
  });

  it('tiến một bước; lùi cần chọn giai đoạn và lý do ≥ 5 ký tự', () => {
    setItem({ stage: 'REVIEW' });
    card['next']();
    expect(emitted[0]).toEqual({ stage: 'AWAITING_ISSUE' });
    card['open']('back');
    expect(card['backTo']()).toBe('FIELDWORK');
    card['reason'].set('abc');
    expect(card['modalValid']()).toBe(false);
    card['reason'].set('Bổ sung thủ tục');
    card['confirm']();
    expect(emitted[1]).toEqual({ stage: 'FIELDWORK', reason: 'Bổ sung thủ tục' });
  });

  it('phát hành cần số, ngày và người ký 1; không có nút tiến sang Đã phát hành', () => {
    setItem({ stage: 'AWAITING_ISSUE' });
    expect(card['nextStage']()).toBeNull();
    card['open']('issue');
    card['reportNumber'].set(' 01/BCKT ');
    expect(card['modalValid']()).toBe(false);
    card['issueSigner'].set('m');
    card['reportDate'].set(new Date(2026, 2, 31));
    card['confirm']();
    expect(emitted[0]).toEqual({
      reportNumber: '01/BCKT',
      reportDate: '2026-03-31',
      signer1Id: 'm',
      file: null,
    });
  });
});

describe('ContractDossierCardComponent', () => {
  const DOSSIER: ContractDossier = {
    revision: 3,
    clientDeliveryStatus: 'NOT_SENT',
    clientDeliveredAt: null,
    originalFilingStatus: 'NOT_FILED',
    originalFiledAt: null,
    originalFilingNote: null,
    acceptanceStatus: 'NONE',
    acceptanceSignedAt: null,
    acceptanceDocument: null,
  };

  it('bắt buộc ngày khi đã gửi; BBNT đã ký cần ngày và bản đã ký', async () => {
    await TestBed.configureTestingModule({ imports: [ContractDossierCardComponent] })
      .overrideComponent(ContractDossierCardComponent, { set: { template: '', imports: [] } })
      .compileComponents();
    const fixture = TestBed.createComponent(ContractDossierCardComponent);
    const card = fixture.componentInstance;
    fixture.componentRef.setInput('dossier', DOSSIER);
    fixture.detectChanges();
    const saved: unknown[] = [];
    card.save.subscribe((v) => saved.push(v));
    expect(card['valid']()).toBe(true);
    card['delivery'].set('HARD_COPY');
    expect(card['valid']()).toBe(false);
    card['deliveredAt'].set(new Date(2026, 9, 1));
    card['acceptance'].set('SIGNED');
    card['signedAt'].set(new Date(2026, 9, 2));
    expect(card['valid']()).toBe(false);
    card['documentId'].set('doc');
    card['submit']();
    expect(saved[0]).toMatchObject({
      revision: 3,
      clientDeliveryStatus: 'HARD_COPY',
      clientDeliveredAt: '2026-10-01',
      acceptanceStatus: 'SIGNED',
      acceptanceSignedAt: '2026-10-02',
      acceptanceDocumentId: 'doc',
    });
  });
});

describe('rateColor', () => {
  it('tô màu theo ngưỡng mặc định G8', () => {
    expect(rateColor(null)).toBe('default');
    expect(rateColor(95)).toBe('green');
    expect(rateColor(90)).toBe('gold');
    expect(rateColor(84.9)).toBe('red');
  });
});
