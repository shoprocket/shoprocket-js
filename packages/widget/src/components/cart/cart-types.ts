import type { Cart } from '@shoprocket/core';
import type { CustomerData, CustomerFormErrors } from '../customer-form';
import type { AddressData, AddressFormErrors } from '../address-form';

/**
 * Checkout step types
 */
export type CheckoutStep = 'customer' | 'shipping' | 'billing' | 'payment' | 'review';

/**
 * Whether this email has shopped here before. There is no password flag: customers do not have
 * passwords, so recognition only ever unlocks "email me a code".
 */
export interface CustomerCheckResult {
  exists: boolean;
}

/**
 * Shared cart state interface
 */
export interface CartState {
  cart: Cart | null;
  isOpen: boolean;
  isCheckingOut: boolean;
  checkoutStep: CheckoutStep;
  customerData: Partial<CustomerData>;
  shippingAddress: Partial<AddressData>;
  billingAddress: Partial<AddressData>;
  sameAsBilling: boolean;
  isGuest: boolean;
  customerErrors: CustomerFormErrors;
  shippingErrors: AddressFormErrors;
  billingErrors: AddressFormErrors;
  checkoutLoading: boolean;
  chunkLoading: boolean;
}

/**
 * Order details from API response
 */
// The order-success screen consumes `OrderReceipt` from @shoprocket/core (D48) - the legacy
// half-snake-case `OrderDetails` shape it replaced was fed by v3 responses that no longer exist.