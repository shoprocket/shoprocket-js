/**
 * Centralized cart state management
 * Single source of truth for all cart-related data
 */

import type { Cart } from '../types/api';
import { internalState } from './internal-state';

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
}

// CheckoutData is temporary session data for the current checkout
export interface CheckoutData {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
}

// Legacy alias for compatibility during refactor
export type CustomerData = CheckoutData;

export interface CartState {
  cart: Cart | null;
  checkoutData: Partial<CheckoutData>;
  shippingAddress: Partial<Address>;
  billingAddress: Partial<Address>;
  sameAsBilling: boolean;
  loading: boolean;
  error: string | null;
  // Legacy alias during refactor
  customer?: Partial<CheckoutData>;
}

type StateListener = (state: CartState) => void;
type UnsubscribeFn = () => void;

class CartStateManager {
  private state: CartState = {
    cart: null,
    checkoutData: {},
    shippingAddress: {},
    billingAddress: {},
    sameAsBilling: true,
    loading: false,
    error: null,
    customer: {} // Legacy alias
  };

  private listeners = new Set<StateListener>();
  private updateTimer?: number;
  private sdk: any = null;

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

  /**
   * Update cart from API response
   */
  setCart(cart: Cart | null): void {
    if (this.isEqual(this.state.cart, cart)) return;
    
    this.state.cart = cart;
    
    // Update internal state for public API
    internalState.setCart(cart);
    
    // Cart no longer contains checkout data in new API
    // Checkout data must be loaded separately via loadCheckoutData()
    
    this.notifyListeners();
  }

  /**
   * Load and set checkout data from API
   */
  async loadCheckoutData(): Promise<void> {
    if (!this.sdk) return;
    
    try {
      const checkoutData = await this.sdk.cart.getCheckoutData();
      this.setCheckoutData(checkoutData);
    } catch (error) {
      // No checkout data yet - that's ok for new carts
      console.debug('No checkout data yet');
    }
  }

  /**
   * Set checkout data from API response
   */
  setCheckoutData(data: any): void {
    if (!data) return;
    
    // Update checkout data fields
    this.state.checkoutData = {
      email: data.email || '',
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      phone: data.phone || '',
      company: data.company || ''
    };
    
    // Keep legacy alias in sync
    this.state.customer = this.state.checkoutData;
    
    // Update addresses
    if (data.shipping_address) {
      this.state.shippingAddress = this.cleanObject(data.shipping_address);
    }
    
    if (data.billing_address) {
      this.state.billingAddress = this.cleanObject(data.billing_address);
    }
    
    // Don't update same_as_billing from API - it's UI state only
    // Intelligently set it based on whether addresses match (only on initial load)
    if (!this.state.checkoutData.email) {
      // First time loading - check if addresses match
      this.state.sameAsBilling = this.areAddressesEqual(
        data.shipping_address,
        data.billing_address
      );
    }
    // Otherwise keep the current UI state
    
    this.notifyListeners();
  }
  
  /**
   * Legacy method for backward compatibility
   * @deprecated Use loadCheckoutData instead
   */
  async loadCustomer(): Promise<void> {
    return this.loadCheckoutData();
  }
  
  /**
   * Legacy method for backward compatibility
   * @deprecated Use setCheckoutData instead
   */
  setCustomer(customer: any): void {
    this.setCheckoutData(customer);
  }

  /**
   * Update checkout data
   */
  updateCheckoutData(data: Partial<CheckoutData>): void {
    // Clean the data before merging
    const cleanedData = this.cleanObject(data);
    const newData = { ...this.state.checkoutData, ...cleanedData };
    if (this.isEqual(this.state.checkoutData, newData)) return;
    
    this.state.checkoutData = newData;
    this.state.customer = newData; // Keep legacy alias in sync
    this.notifyListeners();
    this.scheduleApiUpdate();
  }
  
  /**
   * Legacy method for backward compatibility
   * @deprecated Use updateCheckoutData instead
   */
  updateCustomer(data: Partial<CustomerData>): void {
    this.updateCheckoutData(data);
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
   * Check if we have changes to sync
   */
  private hasChanges(): boolean {
    // We always have changes if we have checkout data with email
    // Since cart and checkout data are now separate, we can't compare against cart
    return !!this.state.checkoutData.email;
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
   * Sync state to API
   */
  private async syncToApi(): Promise<void> {
    if (!this.sdk || !this.hasChanges()) return;
    
    // Only sync if we have minimum required data
    if (!this.state.checkoutData.email) return;
    
    try {
      const payload: any = {
        ...this.state.checkoutData
        // Don't send same_as_billing - it's UI state only
      };
      
      // Always send shipping address if valid
      if (this.isAddressValid(this.state.shippingAddress)) {
        payload.shipping_address = this.state.shippingAddress;
      }
      
      // Always send billing address
      // If same_as_billing is true in UI, we copy shipping to billing
      if (this.state.sameAsBilling && this.isAddressValid(this.state.shippingAddress)) {
        payload.billing_address = this.state.shippingAddress;
      } else if (this.isAddressValid(this.state.billingAddress)) {
        payload.billing_address = this.state.billingAddress;
      }
      
      const updatedData = await this.sdk.cart.updateCheckoutData(payload);
      
      // Update checkout state with the response
      this.setCheckoutData(updatedData);
      
      // Note: We don't update cart here - checkout data and cart are separate
      
    } catch (error) {
      console.error('Failed to sync cart to API:', error);
      this.setError('Failed to update cart');
    }
  }

  /**
   * Check if address has minimum required fields
   */
  private isAddressValid(address: Partial<Address>): boolean {
    return !!(address.line1 && address.city && address.postal_code && address.country);
  }

  /**
   * Clean object by removing empty string values and undefined
   */
  private cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
    const cleaned: Partial<T> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Only include non-empty values
      if (value !== '' && value !== null && value !== undefined) {
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
      customer: {} // Legacy alias
    };
    
    internalState.clear();
    this.notifyListeners();
  }
  
  private areAddressesEqual(addr1: any, addr2: any): boolean {
    if (!addr1 || !addr2) return false;
    
    // Compare relevant address fields
    const fields = ['line1', 'line2', 'city', 'state', 'postal_code', 'country'];
    return fields.every(field => addr1[field] === addr2[field]);
  }
}

// Export singleton instance
export const cartState = new CartStateManager();