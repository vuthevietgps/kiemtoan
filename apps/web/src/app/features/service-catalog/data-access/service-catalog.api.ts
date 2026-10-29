import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';
import { BillingCycle } from '../../contracts/contract-labels';

export type PricingBasis = 'NONE' | 'DOCUMENT_COUNT' | 'ANNUAL_REVENUE' | 'EMPLOYEE_COUNT' | 'OTHER';
export type PriceListStatus = 'UPCOMING' | 'ACTIVE' | 'EXPIRED';

export interface ServiceType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  cycle: BillingCycle;
  /** Không có khi người dùng thiếu quyền tài chính. */
  defaultPrice?: string;
  pricingBasis: PricingBasis;
  pricingUnit: string | null;
  isActive: boolean;
  /** Dịch vụ phát hành báo cáo kiểm toán (04-F). */
  issuesAuditReport: boolean;
  /** Quy trình mặc định và phiên bản đang hiệu lực (null nếu chưa có). */
  defaultWorkflow: {
    templateId: string;
    code: string;
    name: string;
    versionId: string | null;
    versionNo: number | null;
    stepCount: number;
  } | null;
}

export interface ServiceTypeInput {
  code: string;
  name: string;
  description?: string | null;
  cycle: BillingCycle;
  defaultPrice: string;
  pricingBasis: PricingBasis;
  pricingUnit: string | null;
  isActive: boolean;
  issuesAuditReport: boolean;
}

export interface ServiceTypeFilter {
  active: '' | 'true' | 'false';
  search: string;
}

export interface PriceTier {
  id?: string;
  minValue: string;
  maxValue: string | null;
  unitPrice: string;
  note?: string | null;
}

export interface PriceList {
  id: string;
  effectiveFrom: string;
  pricingBasis: PricingBasis;
  pricingUnit: string | null;
  note: string | null;
  tiers: PriceTier[];
  status: PriceListStatus;
  editable: boolean;
}

export interface PriceListInput {
  effectiveFrom: string;
  note: string | null;
  tiers: PriceTier[];
}

@Injectable({ providedIn: 'root' })
export class ServiceCatalogApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/service-types`;

  list(filter?: Partial<ServiceTypeFilter>): Observable<ServiceType[]> {
    return this.http.get<ServiceType[]>(this.url, { params: toParams({ ...filter }) });
  }

  create(input: ServiceTypeInput): Observable<ServiceType> {
    return this.http.post<ServiceType>(this.url, input);
  }

  update(id: string, input: Partial<ServiceTypeInput>): Observable<ServiceType> {
    return this.http.patch<ServiceType>(`${this.url}/${id}`, input);
  }

  priceLists(serviceId: string): Observable<PriceList[]> {
    return this.http.get<PriceList[]>(`${this.url}/${serviceId}/price-lists`);
  }

  createPriceList(serviceId: string, input: PriceListInput): Observable<PriceList> {
    return this.http.post<PriceList>(`${this.url}/${serviceId}/price-lists`, input);
  }

  updatePriceList(serviceId: string, id: string, input: PriceListInput): Observable<PriceList> {
    return this.http.put<PriceList>(`${this.url}/${serviceId}/price-lists/${id}`, input);
  }

  removePriceList(serviceId: string, id: string): Observable<{ id: string }> {
    return this.http.delete<{ id: string }>(`${this.url}/${serviceId}/price-lists/${id}`);
  }
}
