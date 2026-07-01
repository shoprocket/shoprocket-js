/**
 * Loads the PayPal JS SDK for the Connected Path (multiparty) flow.
 *
 * The SDK is initialised with the platform client id and the connected seller's
 * merchant id, plus the partner attribution (BN) code, so payments are processed
 * on the seller's behalf and attributed to the platform. Sandbox vs live is
 * determined by the client id, not the URL.
 */

export interface PayPalSdkConfig {
  clientId: string;
  merchantId: string;
  bnCode: string;
  currency?: string;
}

let paypalSdkPromise: Promise<any> | null = null;

/**
 * Build the PayPal SDK script URL. Exported for testing.
 */
export function buildPayPalSdkUrl(config: PayPalSdkConfig): string {
  const params = new URLSearchParams({
    'client-id': config.clientId,
    'merchant-id': config.merchantId,
    components: 'buttons',
    'enable-funding': 'venmo,paylater',
    // Hide PayPal's inline guest-card form (it re-collects billing address that
    // we already have). Card entry will return via Advanced Card Payments.
    'disable-funding': 'card',
    currency: (config.currency || 'USD').toUpperCase(),
    intent: 'capture',
  });

  return `https://www.paypal.com/sdk/js?${params.toString()}`;
}

/**
 * Load the PayPal SDK once and resolve with the global `paypal` namespace.
 * Concurrent calls share a single in-flight load.
 */
export function loadPayPalSdk(config: PayPalSdkConfig): Promise<any> {
  if ((window as any).paypal) {
    return Promise.resolve((window as any).paypal);
  }

  if (paypalSdkPromise) {
    return paypalSdkPromise;
  }

  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = buildPayPalSdkUrl(config);
    script.setAttribute('data-partner-attribution-id', config.bnCode);
    script.async = true;

    script.onload = () => resolve((window as any).paypal);
    script.onerror = () => {
      // Allow a later retry if the network hiccups.
      paypalSdkPromise = null;
      reject(new Error('Failed to load the PayPal SDK'));
    };

    document.head.appendChild(script);
  });

  return paypalSdkPromise;
}
