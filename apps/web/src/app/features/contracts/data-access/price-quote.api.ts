import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL, toParams } from '../../../core/api/api';

export type QuoteFallbackReason = 'NO_PRICE_LIST' | 'NO_TIER';

/** Kết quả `GET /service-types/:id/price-quote` của 03 (bảng giá theo ngày và bậc). */
export interface PriceQuote {
  serviceTypeId: string;
  date: string;
  value: string | null;
  unitPrice: string;
  /** true khi không có bảng giá/bậc phù hợp và dùng giá chuẩn của dịch vụ. */
  fallback: boolean;
  reason: QuoteFallbackReason | null;
  priceListId: string | null;
  tierId: string | null;
}

export interface PriceQuoteQuery {
  date: string | null;
  value: number | null;
}

/** Đọc báo giá của danh mục dịch vụ cho form hợp đồng (04-E); cần quyền tài chính. */
@Injectable({ providedIn: 'root' })
export class PriceQuoteApi {
  private readonly http = inject(HttpClient);

  quote(serviceTypeId: string, query: PriceQuoteQuery): Observable<PriceQuote> {
    return this.http.get<PriceQuote>(`${API_URL}/service-types/${serviceTypeId}/price-quote`, {
      params: toParams({ date: query.date, value: query.value }),
    });
  }
}
