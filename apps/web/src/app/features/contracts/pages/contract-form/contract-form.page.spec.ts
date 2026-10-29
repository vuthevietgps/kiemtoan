import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  ServiceCatalogApi,
  ServiceType,
} from '../../../service-catalog/data-access/service-catalog.api';
import { ContractDetail, ContractsApi } from '../../data-access/contracts.api';
import { PriceQuote, PriceQuoteApi } from '../../data-access/price-quote.api';
import { toDateString } from '../../form-utils';
import { ContractFormPage } from './contract-form.page';

const SERVICE: ServiceType = {
  id: 'service',
  code: 'ACC',
  name: 'Accounting',
  description: null,
  cycle: 'MONTHLY',
  defaultPrice: '1000000',
  pricingBasis: 'NONE',
  pricingUnit: null,
  isActive: true,
  issuesAuditReport: false,
  defaultWorkflow: null,
};

const TIERED: ServiceType = {
  ...SERVICE,
  id: 'tiered',
  pricingBasis: 'ANNUAL_REVENUE',
  pricingUnit: 'đồng',
};

function quoteOf(unitPrice: string): PriceQuote {
  return {
    serviceTypeId: 'service',
    date: '2026-10-01',
    value: null,
    unitPrice,
    fallback: false,
    reason: null,
    priceListId: 'list',
    tierId: 'tier',
  };
}

const CONTRACT: ContractDetail = {
  id: 'contract',
  code: 'HD-2026-001',
  customerId: 'customer',
  customer: { id: 'customer', name: 'Customer', taxCode: '0100000001', address: null },
  ownerId: 'owner',
  owner: { id: 'owner', fullName: 'Owner' },
  approvedBy: null,
  approvedAt: null,
  returnedReason: null,
  returnedAt: null,
  signedDate: '2026-10-01',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  vatRate: '10',
  subtotal: '100',
  vatAmount: '10',
  total: '110',
  status: 'DRAFT',
  note: 'Original note',
  salesOwnerId: null,
  salesOwner: null,
  referrerName: null,
  referrerPhone: null,
  referrerNote: null,
  cancelReason: null,
  cancelledAt: null,
  cancelledBy: null,
  renewedFrom: null,
  renewals: [],
  services: [
    {
      id: 'line',
      serviceTypeId: 'service',
      serviceType: { id: 'service', code: 'ACC', name: 'Accounting', cycle: 'MONTHLY' },
      description: null,
      period: null,
      quantity: 1,
      unitPrice: '100',
      amount: '100',
      status: 'NOT_STARTED',
      assigneeId: null,
      assignee: null,
      taskGenerationStatus: 'PENDING',
      taskGenerationMessage: null,
      plan: null,
    },
  ],
  installments: [
    {
      id: 'installment',
      name: 'Payment',
      amount: '110',
      dueDate: '2026-10-31',
      paidAmount: '0',
      dueRule: 'FIXED_DATE',
      dueOffsetDays: null,
      milestoneDate: null,
      awaitingMilestone: false,
      overdueDays: null,
    },
  ],
  payments: [],
  invoices: [],
  paidAmount: '0',
  pendingAmount: '0',
  overdueAmount: '0',
  remainingAmount: '110',
  paymentStatus: 'UNPAID',
  invoicedSubtotal: '0',
  taskProgress: { total: 0, done: 0 },
};

describe('ContractFormPage save flow', () => {
  let fixture: ComponentFixture<ContractFormPage>;
  let page: ContractFormPage;
  const api = {
    get: vi.fn<ContractsApi['get']>(),
    create: vi.fn<ContractsApi['create']>(),
    update: vi.fn<ContractsApi['update']>(),
    userOptions: vi.fn(() => of([])),
    customerOptions: vi.fn(() => of([])),
  };
  const message = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const navigate = vi.fn().mockResolvedValue(true);
  const catalog = { list: vi.fn<ServiceCatalogApi['list']>() };
  const quoteApi = { quote: vi.fn<PriceQuoteApi['quote']>() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.get.mockReturnValue(of(CONTRACT));
    api.create.mockReturnValue(of(CONTRACT));
    api.update.mockReturnValue(of(CONTRACT));
    api.userOptions.mockReturnValue(of([]));
    api.customerOptions.mockReturnValue(of([]));
    catalog.list.mockReturnValue(of([]));
    quoteApi.quote.mockReturnValue(of(quoteOf('1500000')));
    await TestBed.configureTestingModule({
      imports: [ContractFormPage],
      providers: [
        { provide: ContractsApi, useValue: api },
        { provide: ServiceCatalogApi, useValue: catalog },
        { provide: PriceQuoteApi, useValue: quoteApi },
        { provide: AuthService, useValue: { can: () => true } },
        { provide: NzMessageService, useValue: message },
        { provide: Router, useValue: { navigate } },
      ],
    })
      .overrideComponent(ContractFormPage, {
        set: { template: '', imports: [] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(ContractFormPage);
    page = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  function loadEditor(): void {
    fixture.componentRef.setInput('id', CONTRACT.id);
    fixture.detectChanges();
  }

  function fillNewContract(): void {
    page['form'].patchValue({ customerId: CONTRACT.customerId });
    page.services.at(0).patchValue({ serviceTypeId: 'service', unitPrice: 100 });
  }

  it('sends explicit nulls when optional fields are cleared in the editor', () => {
    loadEditor();
    page['form'].patchValue({ ownerId: null, signedDate: null, endDate: null, note: '  ' });
    page['save']();
    expect(api.update).toHaveBeenCalledWith(
      CONTRACT.id,
      expect.objectContaining({
        ownerId: null,
        signedDate: null,
        endDate: null,
        note: null,
      }),
    );
    expect(navigate).toHaveBeenCalledWith(['/contracts', CONTRACT.id]);
  });

  it('does not submit an edit while the existing contract is still loading', () => {
    api.get.mockReturnValue(new Subject<ContractDetail>());
    loadEditor();
    page['addService']();
    fillNewContract();
    expect(page['form'].valid).toBe(true);
    page['save']();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('shows a loading failure and does not submit a partially loaded editor', () => {
    api.get.mockReturnValue(throwError(() => ({ error: { message: 'Load failed' } })));
    loadEditor();
    page['addService']();
    fillNewContract();
    expect(page['loadError']()).toBe('Load failed');
    expect(page['loading']()).toBe(false);
    page['save']();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('does not submit an approved contract even if save is called directly', () => {
    api.get.mockReturnValue(of({ ...CONTRACT, status: 'IN_PROGRESS' }));
    loadEditor();
    expect(page['form'].valid).toBe(true);
    page['save']();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('sends only one create request while a save is pending', () => {
    const response = new Subject<ContractDetail>();
    api.create.mockReturnValue(response);
    fixture.detectChanges();
    fillNewContract();
    page['save']();
    page['save']();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(page['saving']()).toBe(true);
    response.next(CONTRACT);
    response.complete();
    expect(page['saving']()).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('allows another save after a failed request', () => {
    loadEditor();
    api.update.mockReturnValueOnce(throwError(() => ({ error: { message: 'Save failed' } })));
    page['save']();
    expect(page['saving']()).toBe(false);
    expect(message.error).toHaveBeenCalledWith('Save failed');
    page['save']();
    expect(api.update).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('07-D2: offers "after audit report issue" only with an audit-report service and sends rule and days', () => {
    catalog.list.mockReturnValue(of([SERVICE, { ...SERVICE, id: 'audit', issuesAuditReport: true }]));
    fixture.detectChanges();
    fillNewContract();
    expect(page['hasAuditLine']()).toBe(false);
    page.services.at(0).controls.serviceTypeId.setValue('audit');
    expect(page['hasAuditLine']()).toBe(true);
    page['addInstallment']();
    page.installments.at(0).patchValue({
      dueDate: new Date(2026, 11, 31),
      dueRule: 'AFTER_REPORT_ISSUE',
      dueOffsetDays: 15,
    });
    page['save']();
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        installments: [
          expect.objectContaining({
            dueDate: '2026-12-31',
            dueRule: 'AFTER_REPORT_ISSUE',
            dueOffsetDays: 15,
          }),
        ],
      }),
    );
  });

  it('rejects an incomplete form before calling the API', () => {
    fixture.detectChanges();
    page['save']();
    expect(api.create).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledTimes(1);
  });

  function chooseService(serviceTypeId: string) {
    const line = page.services.at(0);
    line.controls.serviceTypeId.setValue(serviceTypeId);
    page['onServiceChange'](line);
    return line;
  }

  it('fills the price-list price for the contract start date when a service is chosen', () => {
    catalog.list.mockReturnValue(of([SERVICE]));
    fixture.detectChanges();
    const line = chooseService('service');
    expect(quoteApi.quote).toHaveBeenCalledWith('service', {
      date: toDateString(page['form'].controls.startDate.value),
      value: null,
    });
    expect(line.controls.unitPrice.value).toBe(1_500_000);
    expect(page['suggestionHint'](line)).toMatchObject({ price: 1_500_000, canApply: false });
  });

  it('asks for the criterion value of a tiered service before quoting', () => {
    catalog.list.mockReturnValue(of([TIERED]));
    fixture.detectChanges();
    const line = chooseService('tiered');
    expect(quoteApi.quote).not.toHaveBeenCalled();
    expect(page['criterionLabel'](line)).toBe('Doanh thu năm (đồng)');
    expect(page['suggestionHint'](line)?.text).toBe(page['text'].suggestNeedsValue);

    line.controls.criterionValue.setValue(5_000_000_000);
    page['refreshSuggestion'](line);
    expect(quoteApi.quote).toHaveBeenLastCalledWith('tiered', {
      date: expect.any(String),
      value: 5_000_000_000,
    });
    expect(line.controls.unitPrice.value).toBe(1_500_000);
  });

  it('quotes again when the start date changes but keeps a price the user typed', () => {
    catalog.list.mockReturnValue(of([SERVICE]));
    fixture.detectChanges();
    const line = chooseService('service');
    line.controls.unitPrice.setValue(1_234_000);
    quoteApi.quote.mockReturnValue(of(quoteOf('1800000')));
    page['form'].controls.startDate.setValue(new Date(2027, 0, 1));
    expect(quoteApi.quote).toHaveBeenLastCalledWith('service', { date: '2027-01-01', value: null });
    expect(line.controls.unitPrice.value).toBe(1_234_000);
    expect(page['suggestionHint'](line)).toMatchObject({ price: 1_800_000, canApply: true });
  });

  it('does not replace saved prices when an existing contract is opened', () => {
    catalog.list.mockReturnValue(of([SERVICE]));
    loadEditor();
    const line = page.services.at(0);
    expect(quoteApi.quote).toHaveBeenCalled();
    expect(line.controls.unitPrice.value).toBe(100);
    expect(page['suggestionHint'](line)).toMatchObject({ canApply: true });
  });

  it('does not quote an approved contract', () => {
    catalog.list.mockReturnValue(of([SERVICE]));
    api.get.mockReturnValue(of({ ...CONTRACT, status: 'IN_PROGRESS' }));
    loadEditor();
    expect(quoteApi.quote).not.toHaveBeenCalled();
  });
});

describe('ContractFormPage without financial access', () => {
  it('falls back to the default price and never calls the price quote', async () => {
    const quote = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ContractFormPage],
      providers: [
        {
          provide: ContractsApi,
          useValue: { userOptions: () => of([]), customerOptions: () => of([]) },
        },
        { provide: ServiceCatalogApi, useValue: { list: () => of([SERVICE]) } },
        { provide: PriceQuoteApi, useValue: { quote } },
        { provide: AuthService, useValue: { can: () => false } },
        { provide: NzMessageService, useValue: { error: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    })
      .overrideComponent(ContractFormPage, { set: { template: '', imports: [] } })
      .compileComponents();
    const fixture = TestBed.createComponent(ContractFormPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const line = page.services.at(0);
    line.controls.serviceTypeId.setValue('service');
    page['onServiceChange'](line);
    expect(quote).not.toHaveBeenCalled();
    expect(line.controls.unitPrice.value).toBe(1_000_000);
    expect(page['criterionLabel'](line)).toBeNull();
    fixture.destroy();
  });
});
