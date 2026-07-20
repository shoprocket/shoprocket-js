import { ApiClient } from '../api';

/**
 * The storefront's view of customer identity (D32).
 *
 * Two things about this surface are easy to get wrong:
 *
 *  * **Authentication gates READS, never writes.** Anyone may PATCH an email onto a cart - that is
 *    what makes abandonment tracking work, and nothing here is required in order to buy. What a
 *    session buys is the right to READ a saved address or an order history.
 *  * **A code proves possession of an inbox, nothing more.** It is not a password: short,
 *    single-use, short-lived, and defended by expiry, an attempt cap and rate limiting rather than
 *    by entropy. There is no customer password anywhere in this API.
 *
 * "Guest" is not a state in the data model - a guest is simply a customer who has never
 * authenticated. There is no flag to set and none to read back.
 */

/** The authenticated customer, as the storefront sees itself. Deliberately narrow. */
export interface CustomerIdentity {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface RequestCodeResult {
  /**
   * False when no customer exists for the email - nothing was emailed, because there is no history
   * to authenticate into.
   */
  sent: boolean;
  /**
   * Whether this email has shopped here before. Mirrors `sent`, named for the caller: this is what
   * lets a storefront say "welcome back" instead of demanding a code from someone who has never
   * bought. It is also why no separate "does this email exist" probe is needed, or offered.
   */
  recognised: boolean;
  /** Seconds until another code may be requested, when the caller is being throttled. */
  retryAfterSeconds: number | null;
}

export interface VerifyCodeResult {
  /** Returned in the body ONCE. Store it and present it on every authenticated read. */
  token: string;
  expiresAt: string;
  customer: CustomerIdentity;
}

/** A past order as its own customer may see it - narrower than the seller's order record. */
export interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  currencyCode: string;
  /** Minor units, like every other amount on this surface. */
  total: number;
  placedAt: string | null;
}

export interface CustomerAddress {
  id: string;
  name: string | null;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
  phone: string | null;
}

/** Digits in a login code. Six is what people expect and can retype from an email without error. */
export const OTP_CODE_LENGTH = 6;

// ---- Shapes the account dashboard renders, which the API does not serve yet ----
//
// These describe screens that are built and waiting on routes: an editable profile, a single-order
// detail view, and a pager over order history. `/customer/*` currently serves identity, addresses
// and an unpaged order list. Kept so those screens keep their types; see `updateProfile` /
// `getOrder` below for what happens if you call into them today.

/**
 * Richer than `CustomerIdentity`: the lifetime stats a dashboard shows.
 *
 * Every field beyond the identity is OPTIONAL, and that is the point - `me()` returns an identity
 * and nothing more, so these are absent in practice today. Typing them as present would make the
 * dashboard claim numbers it never received.
 */
export interface CustomerProfile extends CustomerIdentity {
  phone?: string | null;
  ordersCount?: number;
  totalSpent?: number;
  lastOrderAt?: string | null;
  createdAt?: string;
}

export interface CustomerOrderItem {
  id: string;
  productName: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  price: { amount: number; currency: string; formatted: string };
  subtotal: { amount: number; currency: string; formatted: string };
}

export interface CustomerOrderAddress {
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
}

/** One order in full, as its own customer may see it. Not served. */
export interface CustomerOrderDetail extends CustomerOrder {
  items: CustomerOrderItem[];
  shippingAddress: CustomerOrderAddress | null;
  billingAddress: CustomerOrderAddress | null;
  totals: {
    subtotal: { amount: number; currency: string; formatted: string };
    tax: { amount: number; currency: string; formatted: string };
    shipping: { amount: number; currency: string; formatted: string };
    discount: { amount: number; currency: string; formatted: string };
    total: { amount: number; currency: string; formatted: string };
  };
  trackingNumber: string | null;
  shippedAt: string | null;
}

export interface PaginationMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export class AccountService {
  constructor(private api: ApiClient) {}

  /**
   * Email a login code, if the address has shopped here before.
   *
   * A `sent: false` answer is a normal outcome, not an error - render the "we have not seen you
   * before" path rather than a failure. `retryAfterSeconds` is set when the caller is throttled;
   * show it rather than silently swallowing the refusal.
   */
  async requestCode(email: string): Promise<RequestCodeResult> {
    const response = await this.api.post<any>('/customer/otp', { email });
    return response.data ?? response;
  }

  /**
   * Exchange a code for a session. Hand the returned token to `setCustomerToken()` - nothing else
   * re-issues it, so losing it means asking for another code.
   */
  async verifyCode(email: string, code: string): Promise<VerifyCodeResult> {
    const response = await this.api.post<any>('/customer/otp/verify', { email, code });
    return response.data ?? response;
  }

  /** The signed-in customer. Requires a session token. */
  async me(): Promise<CustomerIdentity> {
    const response = await this.api.get<any>('/customer/me');
    return response.data ?? response;
  }

  /** The customer's saved address book. Requires a session token. */
  async getAddresses(): Promise<CustomerAddress[]> {
    const response = await this.api.get<any>('/customer/addresses');
    return response.data ?? [];
  }

  /** The customer's order history. Requires a session token. */
  async getOrders(): Promise<CustomerOrder[]> {
    const response = await this.api.get<any>('/customer/orders');
    return response.data ?? [];
  }

  /** End the session server-side. Clear the local token too - this does not do it for you. */
  async signOut(): Promise<void> {
    await this.api.post<any>('/customer/signout', {});
  }

  // ---- Not served yet ----
  //
  // The account dashboard renders an editable profile and a single-order detail view. The API has
  // neither route: `/customer/*` serves identity, addresses and an order LIST, and nothing writes
  // customer fields from the storefront at all. These throw rather than silently resolving, and
  // they exist rather than being deleted because the UI is ahead of the API here, not wrong - the
  // screens are built and waiting. Give them real implementations when the routes land.

  async updateProfile(_data: { firstName?: string; lastName?: string; phone?: string | null }): Promise<never> {
    throw new Error('Not served: the API has no storefront route that writes customer fields');
  }

  async getOrder(_orderId: string): Promise<never> {
    throw new Error('Not served: the API serves a customer order LIST, but no single-order detail');
  }
}
