import { DestroyRef, signal } from '@angular/core';
import { catchError, map, Observable, of, startWith, Subject, switchMap } from 'rxjs';
import { errorMessage } from '../../../../core/api/api';
import { PriceQuote, QuoteFallbackReason } from '../../data-access/price-quote.api';

export type PriceSuggestion =
  | { state: 'loading' }
  | { state: 'needs-value' }
  | { state: 'error'; message: string }
  | { state: 'ready'; unitPrice: number; fallback: boolean; reason: QuoteFallbackReason | null };

export interface SuggestionRequest {
  serviceTypeId: string;
  /** Ngày bắt đầu HĐ dạng YYYY-MM-DD; null thì API dùng hôm nay. */
  date: string | null;
  value: number | null;
  /** Dịch vụ tính giá theo bậc: chưa có giá trị tiêu chí thì chưa gọi API. */
  needsValue: boolean;
}

export interface PriceSuggestionHooks<K> {
  quote: (request: SuggestionRequest) => Observable<PriceQuote>;
  currentPrice: (key: K) => number;
  applyPrice: (key: K, price: number) => void;
}

/**
 * Gợi ý đơn giá cho từng dòng dịch vụ của form HĐ (04-E). Mỗi dòng một luồng `switchMap`
 * nên kết quả cũ về muộn không ghi đè kết quả mới. Giá gợi ý chỉ tự điền khi đơn giá còn
 * trống (0) hoặc vẫn đúng bằng giá đã tự điền lần trước — giá người dùng tự sửa được giữ.
 */
export class PriceSuggestions<K extends object> {
  private readonly state = signal(new Map<K, PriceSuggestion>());
  private readonly streams = new Map<K, Subject<SuggestionRequest | null>>();
  private readonly applied = new Map<K, number>();

  constructor(
    private readonly hooks: PriceSuggestionHooks<K>,
    destroyRef: DestroyRef,
  ) {
    destroyRef.onDestroy(() => this.streams.forEach((stream) => stream.complete()));
  }

  get(key: K): PriceSuggestion | null {
    return this.state().get(key) ?? null;
  }

  /** null = dòng chưa chọn dịch vụ: xoá gợi ý. */
  request(key: K, request: SuggestionRequest | null): void {
    let stream = this.streams.get(key);
    if (!stream) {
      stream = new Subject<SuggestionRequest | null>();
      this.streams.set(key, stream);
      stream.pipe(switchMap((r) => this.resolve(r))).subscribe((s) => this.update(key, s));
    }
    stream.next(request);
  }

  /** Người dùng bấm "Dùng giá này". */
  use(key: K): void {
    const suggestion = this.get(key);
    if (suggestion?.state !== 'ready') return;
    this.applied.set(key, suggestion.unitPrice);
    this.hooks.applyPrice(key, suggestion.unitPrice);
  }

  forget(key: K): void {
    this.streams.get(key)?.complete();
    this.streams.delete(key);
    this.applied.delete(key);
    this.state.update((cur) => withoutKey(cur, key));
  }

  private resolve(request: SuggestionRequest | null): Observable<PriceSuggestion | null> {
    if (!request) return of(null);
    if (request.needsValue && request.value === null) return of({ state: 'needs-value' });
    return this.hooks.quote(request).pipe(
      map((q): PriceSuggestion => ({
        state: 'ready',
        unitPrice: Number(q.unitPrice),
        fallback: q.fallback,
        reason: q.reason,
      })),
      catchError((err: unknown) =>
        of<PriceSuggestion>({ state: 'error', message: errorMessage(err) }),
      ),
      startWith<PriceSuggestion>({ state: 'loading' }),
    );
  }

  private update(key: K, suggestion: PriceSuggestion | null): void {
    this.state.update((cur) => {
      const next = withoutKey(cur, key);
      if (suggestion) next.set(key, suggestion);
      return next;
    });
    if (suggestion?.state !== 'ready') return;
    const current = this.hooks.currentPrice(key);
    const last = this.applied.get(key);
    if (current === 0 || current === last) {
      this.applied.set(key, suggestion.unitPrice);
      this.hooks.applyPrice(key, suggestion.unitPrice);
    }
  }
}

function withoutKey<K, V>(source: Map<K, V>, key: K): Map<K, V> {
  const next = new Map(source);
  next.delete(key);
  return next;
}
