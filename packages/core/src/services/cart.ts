import { ApiClient } from '../api';
import type {
  AddToCartParams,
  Cart,
  CheckoutAccepted,
  CheckoutParams,
  CheckoutRejected,
  OrderPaymentState,
  PatchCartParams,
  ShippingOptions,
  StartPaymentParams,
  StartPaymentResult,
  StorefrontPaymentMethods,
} from '../types';

// Re-export types for consumers of the SDK
export type {
  AddToCartParams,
  Cart,
  CartAddress,
  CartAddressInput,
  CartItem,
  CartPriceChange,
  CartTotals,
  CheckoutAccepted,
  CheckoutParams,
  CheckoutRejected,
  CheckoutRejection,
  OrderPaymentState,
  PatchCartParams,
  PaymentMethodIcon,
  SelectedPaymentMethod,
  ShippingOption,
  ShippingOptions,
  StartPaymentParams,
  StartPaymentResult,
  StorefrontPaymentMethod,
  StorefrontPaymentMethods,
  UpdateCartItemParams,
} from '../types';

/**
 * A checkout the server refused. Carries the structured reason so a caller can re-render the cart
 * (drifted prices, a line that went out of stock) instead of showing a generic failure.
 */
export class CheckoutRejectedError extends Error {
  readonly detail: CheckoutRejected;

  constructor(detail: CheckoutRejected) {
    super(detail.message);
    this.name = 'CheckoutRejectedError';
    this.detail = detail;
  }

  get rejection() {
    return this.detail.rejection;
  }
}

/**
 * The cart surface.
 *
 * Every mutation returns the FULL recalculated cart, so nothing here needs a follow-up GET to see
 * the new totals. The v3 client did PUT-then-GET-then-re-rate on every keystroke; that was three
 * to five sequential round trips for one typed character, and none of them were necessary.
 *
 * A cart is addressed by the client-minted `X-Cart-Token` the ApiClient carries, so an anonymous
 * shopper transacts with no auth round-trip. Writing to a cart never requires authentication -
 * reading anything back about the person behind an email is what does (see AuthService).
 */
export class CartService {
  constructor(private api: ApiClient) {}

  private static unwrap(response: any): Cart {
    return response.data ?? response;
  }

  async get(): Promise<Cart> {
    return CartService.unwrap(await this.api.get<any>('/cart'));
  }

  async addItem(data: AddToCartParams): Promise<Cart> {
    return CartService.unwrap(await this.api.post<any>('/cart/items', data));
  }

  /** Set a line's quantity outright. Zero is a removal. */
  async updateItem(itemId: string, quantity: number): Promise<Cart> {
    return CartService.unwrap(await this.api.patch<any>(`/cart/items/${itemId}`, { quantity }));
  }

  async removeItem(itemId: string): Promise<Cart> {
    return CartService.unwrap(await this.api.delete<any>(`/cart/items/${itemId}`));
  }

  /**
   * Write progressive checkout data - email, either address, the chosen shipping rate - and get the
   * recalculated cart back in the same round trip.
   *
   * Call it as each step is filled in rather than once at place-order. The email in particular has
   * to be persisted as it is typed: an email that only arrives with the final order is by
   * definition only ever captured from the people who did not abandon.
   *
   * An omitted field is left untouched; an explicit null clears it.
   */
  async patch(data: PatchCartParams): Promise<Cart> {
    return CartService.unwrap(await this.api.patch<any>('/cart', data));
  }

  /**
   * The rates available for the address ALREADY STORED on the cart - there is nothing to pass.
   * Deriving them server-side from persisted state is what makes the quoted price provably the
   * price that will be charged when the rate is selected.
   *
   * Select one with `patch({ shippingRateId })`, which returns the recalculated totals.
   */
  async getShippingOptions(): Promise<ShippingOptions> {
    const response = await this.api.get<any>('/cart/shipping-options');
    return response.data ?? response;
  }

  /**
   * The payment methods this store offers, merged and ordered by the server: connected gateways
   * first, then offline methods. Pass an entry's `select` straight back as `checkout({
   * paymentMethod })`.
   *
   * `checkoutDisabled` distinguishes a paused or suspended store from one that simply has nothing
   * set up - an empty list alone cannot tell those apart, and they want different words in front
   * of the shopper.
   */
  async getPaymentMethods(): Promise<StorefrontPaymentMethods> {
    const response = await this.api.get<any>('/payment-methods');
    return response.data ?? response;
  }

  /**
   * Convert the cart into a pending order and reserve its stock. The order exists and holds stock
   * BEFORE the shopper is handed to a gateway, so an abandoned payment leaves something
   * recoverable rather than nothing at all. Take money with `startPayment()`.
   *
   * `paymentMethod` may be omitted only when the store offers exactly one method; with several the
   * server refuses rather than guessing which one the shopper meant.
   *
   * Throws `CheckoutRejectedError` when the server refuses (empty cart, price drift, stock).
   */
  async checkout(data: CheckoutParams = {}): Promise<CheckoutAccepted> {
    try {
      const response = await this.api.post<any>('/cart/checkout', data);
      return response.data ?? response;
    } catch (error: any) {
      if (error?.status === 409 && error?.body?.rejection) {
        throw new CheckoutRejectedError(error.body as CheckoutRejected);
      }
      throw error;
    }
  }

  /** Open a hosted payment session for an order checkout created. Send the shopper to its URL. */
  async startPayment(orderId: string, params: StartPaymentParams): Promise<StartPaymentResult> {
    const response = await this.api.post<any>(`/orders/${orderId}/pay`, params);
    return response.data ?? response;
  }

  /**
   * Poll an order after returning from a hosted payment page.
   *
   * The gateway redirect proves the shopper came back, not that they paid - the webhook is the only
   * writer of payment status, and it lands before, after, or instead of the redirect. So the
   * storefront has to ASK. Authorized by the cart token that produced the order.
   */
  async getOrderStatus(orderId: string): Promise<OrderPaymentState> {
    const response = await this.api.get<any>(`/orders/${orderId}/status`);
    return response.data ?? response;
  }
}
