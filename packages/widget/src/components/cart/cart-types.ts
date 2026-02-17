import type { Cart, Money, TaxBreakdownItem } from '@shoprocket/core';
import type { CustomerData, CustomerFormErrors } from '../customer-form';
import type { AddressData, AddressFormErrors } from '../address-form';

/**
 * Checkout step types
 */
export type CheckoutStep = 'customer' | 'shipping' | 'billing' | 'payment' | 'review';

/**
 * Customer check result from API
 */
export interface CustomerCheckResult {
  exists: boolean;
  has_password: boolean;
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
export interface OrderDetails {
  data?: any;
  order_number?: string;
  items?: any[];
  subtotal?: Money;
  shipping_cost?: Money;
  tax_amount?: Money;
  discount_amount?: Money;
  total?: Money;
  taxInclusive?: boolean;
  taxBreakdown?: TaxBreakdownItem[];
  customer?: {
    email?: string;
  };
}