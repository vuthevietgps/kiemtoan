import { DestroyRef } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PriceQuote } from '../../data-access/price-quote.api';
import { PriceSuggestions, SuggestionRequest } from './price-suggestions';

interface Line {
  price: number;
}

function quote(unitPrice: string, extra: Partial<PriceQuote> = {}): PriceQuote {
  return {
    serviceTypeId: 'service',
    date: '2026-11-01',
    value: null,
    unitPrice,
    fallback: false,
    reason: null,
    priceListId: 'list',
    tierId: 'tier',
    ...extra,
  };
}

const REQUEST: SuggestionRequest = {
  serviceTypeId: 'service',
  date: '2026-11-01',
  value: null,
  needsValue: false,
};

const quoteFn = vi.fn();
let destroy: () => void;
let suggestions: PriceSuggestions<Line>;

beforeEach(() => {
  quoteFn.mockReset();
  const destroyRef = { onDestroy: (fn: () => void) => (destroy = fn) } as unknown as DestroyRef;
  suggestions = new PriceSuggestions<Line>(
    {
      quote: quoteFn,
      currentPrice: (line) => line.price,
      applyPrice: (line, price) => (line.price = price),
    },
    destroyRef,
  );
});

describe('PriceSuggestions auto-fill', () => {
  it('fills an empty unit price with the quoted price', () => {
    quoteFn.mockReturnValue(of(quote('1500000.00')));
    const line = { price: 0 };
    suggestions.request(line, REQUEST);
    expect(quoteFn).toHaveBeenCalledWith(REQUEST);
    expect(line.price).toBe(1_500_000);
    expect(suggestions.get(line)).toEqual({
      state: 'ready',
      unitPrice: 1_500_000,
      fallback: false,
      reason: null,
    });
  });

  it('keeps a price the user typed and only shows the suggestion', () => {
    quoteFn.mockReturnValue(of(quote('1500000')));
    const line = { price: 900_000 };
    suggestions.request(line, REQUEST);
    expect(line.price).toBe(900_000);
    suggestions.use(line);
    expect(line.price).toBe(1_500_000);
  });

  it('follows a new quote while the price is still the previous suggestion', () => {
    const line = { price: 0 };
    quoteFn.mockReturnValue(of(quote('1000000')));
    suggestions.request(line, REQUEST);
    quoteFn.mockReturnValue(of(quote('1200000')));
    suggestions.request(line, { ...REQUEST, date: '2027-01-01' });
    expect(line.price).toBe(1_200_000);

    line.price = 1_100_000;
    quoteFn.mockReturnValue(of(quote('1300000')));
    suggestions.request(line, { ...REQUEST, date: '2027-06-01' });
    expect(line.price).toBe(1_100_000);
  });
});

describe('PriceSuggestions states', () => {
  it('asks for the criterion value without calling the API', () => {
    const line = { price: 0 };
    suggestions.request(line, { ...REQUEST, needsValue: true });
    expect(quoteFn).not.toHaveBeenCalled();
    expect(suggestions.get(line)).toEqual({ state: 'needs-value' });
    expect(line.price).toBe(0);
  });

  it('ignores a slower earlier response once a newer request is sent', () => {
    const first = new Subject<PriceQuote>();
    const line = { price: 0 };
    quoteFn.mockReturnValueOnce(first).mockReturnValueOnce(of(quote('2000000')));
    suggestions.request(line, { ...REQUEST, value: 100, needsValue: true });
    expect(suggestions.get(line)).toEqual({ state: 'loading' });
    suggestions.request(line, { ...REQUEST, value: 600, needsValue: true });
    first.next(quote('500000'));
    expect(line.price).toBe(2_000_000);
  });

  it('reports fallback reasons and API errors without changing the price', () => {
    const line = { price: 700_000 };
    quoteFn.mockReturnValue(
      of(quote('800000', { fallback: true, reason: 'NO_TIER', tierId: null })),
    );
    suggestions.request(line, REQUEST);
    expect(suggestions.get(line)).toMatchObject({ fallback: true, reason: 'NO_TIER' });

    quoteFn.mockReturnValue(throwError(() => ({ error: { message: 'Không có quyền' } })));
    suggestions.request(line, REQUEST);
    expect(suggestions.get(line)).toEqual({ state: 'error', message: 'Không có quyền' });
    expect(line.price).toBe(700_000);
  });

  it('clears a line when the service is removed or the page is destroyed', () => {
    quoteFn.mockReturnValue(of(quote('1000000')));
    const line = { price: 0 };
    suggestions.request(line, REQUEST);
    suggestions.request(line, null);
    expect(suggestions.get(line)).toBeNull();

    suggestions.request(line, REQUEST);
    suggestions.forget(line);
    expect(suggestions.get(line)).toBeNull();
    destroy();
  });
});
