import { describe, expect, it } from 'vitest';
import { buildPayPalSdkUrl } from './paypal-sdk';

describe('buildPayPalSdkUrl', () => {
  const base = {
    clientId: 'PLATFORM-CLIENT',
    merchantId: 'SELLER9',
    bnCode: 'BN-1',
  };

  it('includes the platform client id and seller merchant id', () => {
    const url = new URL(buildPayPalSdkUrl(base));
    expect(url.origin + url.pathname).toBe('https://www.paypal.com/sdk/js');
    expect(url.searchParams.get('client-id')).toBe('PLATFORM-CLIENT');
    expect(url.searchParams.get('merchant-id')).toBe('SELLER9');
  });

  it('enables venmo and pay later funding and capture intent', () => {
    const url = new URL(buildPayPalSdkUrl(base));
    expect(url.searchParams.get('enable-funding')).toBe('venmo,paylater');
    expect(url.searchParams.get('intent')).toBe('capture');
    expect(url.searchParams.get('components')).toBe('buttons');
  });

  it('disables the inline card funding source', () => {
    expect(new URL(buildPayPalSdkUrl(base)).searchParams.get('disable-funding')).toBe('card');
  });

  it('defaults currency to USD and uppercases it', () => {
    expect(new URL(buildPayPalSdkUrl(base)).searchParams.get('currency')).toBe('USD');
    expect(new URL(buildPayPalSdkUrl({ ...base, currency: 'gbp' })).searchParams.get('currency')).toBe('GBP');
  });
});
