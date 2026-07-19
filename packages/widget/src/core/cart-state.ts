/**
 * Centralized cart state management
 * Single source of truth for all cart-related data
 *
 * The server owns the cart. Everything the shopper types is written through `PATCH /cart`, which
 * returns the recalculated cart in the SAME round trip - so this file holds a debounced draft of
 * the form and nothing else. It deliberately does not keep a parallel copy of totals, addresses or
 * the shipping selection: those live on `state.cart`, straight from the last server response.
 */

import type { Cart, CartAddress, CartAddressInput, ShippingOption } from '@shoprocket/core';
import { internalState } from './internal-state';

/**
 * The address form's working copy. Matches the API's cart address field-for-field (`region`,
 * `postalCode`, `countryCode`) rather than the v3 widget's `state`/`country`, so the draft can be
 * sent as-is with no rename layer in between.
 */
export type Address = CartAddressInput;

/** The contact fields collected alongside the addresses. */
export interface CheckoutData {
  email?: string;
  customerName?: string;
}

export interface CartState {
  cart: Cart | null;
  checkoutData: Partial<CheckoutData>;
  shippingAddress: Partial<Address>;
  billingAddress: Partial<Address>;
  sameAsBilling: boolean;
  loading: boolean;
  error: string | null;
  // Shipping rate options for the address currently stored on the cart.
  shippingOptions: ShippingOption[];
  /**
   * True when the cart has no country yet, so no zone can match. Distinct from an empty option
   * list, which means we know where they are and cannot deliver there.
   */
  shippingAddressRequired: boolean;
  shippingOptionsLoading: boolean;
}

type StateListener = (state: CartState) => void;
type UnsubscribeFn = () => void;

const ADDRESS_FIELDS: Array<keyof CartAddress> = [
  'name',
  'company',
  'line1',
  'line2',
  'city',
  'region',
  'postalCode',
  'countryCode',
  'phone',
];

class CartStateManager {
  private state: CartState = {
    cart: null,
    checkoutData: {},
    shippingAddress: {},
    billingAddress: {},
    sameAsBilling: true,
    loading: false,
    error: null,
    shippingOptions: [],
    shippingAddressRequired: true,
    shippingOptionsLoading: false,
  };

  private listeners = new Set<StateListener>();
  private updateTimer?: number;
  private sdk: any = null;
  /** Destination signature of the last rate fetch, so typing an email does not re-rate. */
  private lastShippingOptionsKey: string | null = null;

  constructor() {
    // Sync with existing internalState for backward compatibility
    const existingCart = internalState.getCartData();
    if (existingCart) {
      this.state.cart = existingCart;
    }
  }

  /**
   * Initialize with SDK instance
   */
  init(sdk: any): void {
    this.sdk = sdk;
    internalState.setSdk(sdk);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): UnsubscribeFn {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.getState());

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current state (readonly)
   */
  getState(): Readonly<CartState> {
    return { ...this.state };
  }

  /**
   * Get cart data for public API
   */
  getCart(): Cart | null {
    return this.state.cart;
  }

  /** The shipping rate currently applied to the cart, per the server. */
  getSelectedShippingRateId(): string | null {
    return this.state.cart?.shippingRateId ?? null;
  }

  /**
   * Update cart from an API response, and adopt anything the server has that the form does not.
   *
   * Every cart response carries the persisted email and addresses, so a returning shopper's saved
   * details populate the form with no extra call - but only where the draft is still empty, or a
   * response landing mid-type would overwrite what is being typed.
   */
  setCart(cart: Cart | null): void {
    if (this.isEqual(this.state.cart, cart)) {
      return;
    }

    this.state.cart = cart;
    internalState.setCart(cart);

    if (cart) {
      this.hydrateDraftFromCart(cart);
    }

    this.notifyListeners();
  }

  private hydrateDraftFromCart(cart: Cart): void {
    if (cart.email && !this.state.checkoutData.email) {
      this.state.checkoutData = { ...this.state.checkoutData, email: cart.email };
    }

    for (const kind of ['shipping', 'billing'] as const) {
      const stored = kind === 'shipping' ? cart.shippingAddress : cart.billingAddress;
      if (!stored) continue;
      const key = kind === 'shipping' ? 'shippingAddress' : 'billingAddress';
      const draft = { ...this.state[key] };
      let changed = false;
      for (const field of ADDRESS_FIELDS) {
        if (stored[field] != null && draft[field] == null) {
          draft[field] = stored[field];
          changed = true;
        }
      }
      if (changed) this.state[key] = draft;
    }

    // Both stored and different means the shopper deliberately split them.
    if (cart.shippingAddress && cart.billingAddress) {
      this.state.sameAsBilling = this.areAddressesEqual(cart.shippingAddress, cart.billingAddress);
    }
  }

  /**
   * Update the contact fields (email, name).
   */
  updateCheckoutData(data: Partial<CheckoutData>): void {
    const cleanedData = this.cleanObject(data);
    const newData = { ...this.state.checkoutData, ...cleanedData };
    if (this.isEqual(this.state.checkoutData, newData)) return;

    this.state.checkoutData = newData;
    this.notifyListeners();
    this.scheduleApiUpdate();
  }

  /**
   * Update shipping address
   */
  updateShippingAddress(address: Partial<Address>): void {
    // Clean the address before merging
    const cleanedAddress = this.cleanObject(address);
    const newAddress = { ...this.state.shippingAddress, ...cleanedAddress };
    if (this.isEqual(this.state.shippingAddress, newAddress)) return;

    this.state.shippingAddress = newAddress;

    // If same as billing, update billing too
    if (this.state.sameAsBilling) {
      this.state.billingAddress = { ...newAddress };
    }

    this.notifyListeners();
    this.scheduleApiUpdate();
  }

  /**
   * Update billing address
   */
  updateBillingAddress(address: Partial<Address>): void {
    // Clean the address before merging
    const cleanedAddress = this.cleanObject(address);
    const newAddress = { ...this.state.billingAddress, ...cleanedAddress };
    if (this.isEqual(this.state.billingAddress, newAddress)) return;

    this.state.billingAddress = newAddress;
    this.state.sameAsBilling = false;

    this.notifyListeners();
    this.scheduleApiUpdate();
  }

  /**
   * Toggle same as billing
   */
  setSameAsBilling(same: boolean): void {
    if (this.state.sameAsBilling === same) return;

    this.state.sameAsBilling = same;

    if (same) {
      this.state.billingAddress = { ...this.state.shippingAddress };
    }

    this.notifyListeners();
    this.scheduleApiUpdate();
  }

  /**
   * Set loading state
   */
  setLoading(loading: boolean): void {
    if (this.state.loading === loading) return;
    this.state.loading = loading;
    this.notifyListeners();
  }

  /**
   * Set error state
   */
  setError(error: string | null): void {
    if (this.state.error === error) return;
    this.state.error = error;
    this.notifyListeners();
  }

  /**
   * Flush any pending changes to the API immediately.
   * Call before checkout to ensure all data is synced.
   */
  async flush(): Promise<void> {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = undefined;
    }
    await this.syncToApi();
  }

  /**
   * Check if we have changes to sync
   */
  private hasChanges(): boolean {
    return (
      Object.keys(this.state.checkoutData).length > 0 ||
      Object.keys(this.state.shippingAddress).length > 0 ||
      Object.keys(this.state.billingAddress).length > 0
    );
  }

  /**
   * Schedule API update (debounced)
   */
  private scheduleApiUpdate(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    this.updateTimer = window.setTimeout(() => {
      this.syncToApi();
    }, 500);
  }

  /**
   * Push the draft to the API.
   *
   * ONE request. `PATCH /cart` accepts partial values and returns the recalculated cart, so there
   * is no PUT-then-GET, and no need to withhold a half-typed address until it validates - storing
   * it as it is typed is what makes an abandoned cart attributable to a person.
   */
  private async syncToApi(): Promise<void> {
    if (!this.sdk || !this.hasChanges()) return;

    try {
      const payload: any = { ...this.state.checkoutData };

      if (Object.keys(this.state.shippingAddress).length) {
        payload.shippingAddress = this.state.shippingAddress;
      }

      // "Same as billing" is UI state; what the server stores is a copy of the shipping address.
      const billing = this.state.sameAsBilling
        ? this.state.shippingAddress
        : this.state.billingAddress;
      if (Object.keys(billing).length) {
        payload.billingAddress = billing;
      }

      this.setCart(await this.sdk.cart.patch(payload));

      // The destination may have moved, so the offered rates may have too.
      await this.fetchShippingOptions();
    } catch (error) {
      console.error('Failed to sync cart to API:', error);
      this.setError('Failed to update cart');
    }
  }

  /**
   * Ensure shipping options are loaded for the current address. Safe to call on
   * checkout open / entering the shipping step: the destination-keyed guard makes
   * it a no-op if the options for this address are already loaded. This covers
   * returning customers whose saved address loads without an address-change event.
   */
  async ensureShippingOptions(): Promise<void> {
    await this.fetchShippingOptions();
  }

  /**
   * Fetch the rates available for the address the SERVER has stored. Nothing is passed up: the
   * API derives the options from persisted state, which is what makes the price offered here
   * provably the price that gets charged when one is selected.
   */
  private async fetchShippingOptions(): Promise<void> {
    if (!this.sdk) return;

    // Re-rate only when the destination or the contents actually changed - not on every sync
    // (typing an email must not cost a rate lookup).
    const shipTo = this.state.cart?.shippingAddress;
    const itemCount = this.state.cart?.items?.reduce((n, i) => n + (i.quantity ?? 0), 0) ?? 0;
    const key = `${shipTo?.countryCode ?? ''}|${shipTo?.region ?? ''}|${shipTo?.postalCode ?? ''}|${itemCount}`;
    if (key === this.lastShippingOptionsKey) return;
    this.lastShippingOptionsKey = key;

    try {
      this.state.shippingOptionsLoading = true;
      this.notifyListeners();

      const { options, addressRequired } = await this.sdk.cart.getShippingOptions();
      this.state.shippingOptions = options;
      this.state.shippingAddressRequired = addressRequired;
    } catch (error) {
      this.state.shippingOptions = [];
      // Leave the key cleared so a transient failure can be retried.
      this.lastShippingOptionsKey = null;
    } finally {
      this.state.shippingOptionsLoading = false;
      this.notifyListeners();
    }
  }

  /**
   * Select a shipping rate. One PATCH: the response IS the cart with shipping (and any tax on it)
   * recalculated, so there is nothing to re-fetch afterwards.
   */
  async selectShippingOption(rateId: string): Promise<void> {
    if (!this.sdk || this.state.cart?.shippingRateId === rateId) return;

    try {
      this.setCart(await this.sdk.cart.patch({ shippingRateId: rateId }));
    } catch (error) {
      // The cart still carries the previously applied rate, so the UI reverts by itself.
      this.setError('Failed to select shipping option');
      this.notifyListeners();
    }
  }

  /**
   * Clean object by removing null and undefined values
   * Empty strings are kept as they represent intentional clearing
   */
  private cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
    const cleaned: Partial<T> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Keep empty strings (user cleared the field) but remove null/undefined
      if (value !== null && value !== undefined) {
        cleaned[key as keyof T] = value;
      }
    }

    return cleaned;
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Cart state listener error:', error);
      }
    });
  }

  /**
   * Deep equality check for objects
   */
  private isEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (!a || !b) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => {
      const valA = a[key];
      const valB = b[key];

      if (typeof valA === 'object' && valA !== null) {
        return this.isEqual(valA, valB);
      }

      return valA === valB;
    });
  }

  /**
   * Clear cart state
   */
  clear(): void {
    this.state = {
      cart: null,
      checkoutData: {},
      shippingAddress: {},
      billingAddress: {},
      sameAsBilling: true,
      loading: false,
      error: null,
      shippingOptions: [],
      shippingAddressRequired: true,
      shippingOptionsLoading: false,
    };

    this.lastShippingOptionsKey = null;
    internalState.clear();
    this.notifyListeners();
  }

  private areAddressesEqual(addr1: any, addr2: any): boolean {
    if (!addr1 || !addr2) return false;
    return ADDRESS_FIELDS.every(field => (addr1[field] ?? null) === (addr2[field] ?? null));
  }
}

// Export singleton instance
export const cartState = new CartStateManager();
