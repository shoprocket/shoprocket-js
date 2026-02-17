import { ApiClient } from '../api';
import type { Cart, CartItem, AddToCartParams, UpdateCartItemParams } from '../types';

// Re-export types for backward compatibility
export type { Cart, CartItem, AddToCartParams, UpdateCartItemParams } from '../types';

// Address and checkout types (widget-specific, but needed for cart service)
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface CheckoutData {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  sameAsBilling?: boolean;
}

// Legacy alias for backward compatibility
export type CustomerData = CheckoutData;

export interface CheckCustomerResponse {
  exists: boolean;
  hasPassword: boolean;
}

export class CartService {
  constructor(private api: ApiClient) {}

  async get(): Promise<Cart> {
    const response = await this.api.get<any>('/cart');
    return response.cart || response.data || response;
  }

  async addItem(data: AddToCartParams): Promise<Cart> {
    const response = await this.api.post<any>('/cart/items', data);
    return response.cart || response.data || response;
  }

  async updateItem(itemId: string, quantity: number): Promise<Cart> {
    const response = await this.api.put<any>(`/cart/items/${itemId}`, { quantity });
    return response.cart || response.data || response;
  }

  async removeItem(itemId: string): Promise<Cart> {
    const response = await this.api.delete<any>(`/cart/items/${itemId}`);
    return response.cart || response.data || response;
  }

  async clear(): Promise<Cart> {
    const response = await this.api.delete<any>('/cart');
    return response.cart || response.data || response;
  }

  async getCheckoutData(): Promise<CheckoutData> {
    const response = await this.api.get<any>('/cart/checkout-data');
    return response.data || response;
  }
  
  // Legacy method for backward compatibility
  async getCustomer(): Promise<CheckoutData> {
    return this.getCheckoutData();
  }

  async updateCheckoutData(checkoutData: CheckoutData): Promise<CheckoutData> {
    const response = await this.api.put<any>('/cart/checkout-data', checkoutData);
    return response.data || response;
  }
  
  // Legacy method for backward compatibility
  async updateCustomer(customerData: CheckoutData): Promise<CheckoutData> {
    return this.updateCheckoutData(customerData);
  }

  async checkCheckoutData(email: string): Promise<CheckCustomerResponse> {
    const response = await this.api.post<any>('/cart/check-customer', {
      email
    });
    return response.data || response;
  }
  
  // Legacy method for backward compatibility
  async checkCustomer(email: string): Promise<CheckCustomerResponse> {
    return this.checkCheckoutData(email);
  }

  async sendAuth(email: string): Promise<{ auth_sent: boolean; auth_method?: string; message?: string }> {
    const response = await this.api.post<any>('/cart/send-auth', {
      email
    });
    return response.data || response;
  }
  
  async verifyAuth(email: string, code: string): Promise<{ authenticated: boolean; message?: string }> {
    const response = await this.api.post<any>('/cart/verify-auth', {
      email,
      code
    });
    return response.data || response;
  }

  async passwordLogin(email: string, password: string): Promise<{ authenticated: boolean; message?: string }> {
    const response = await this.api.post<any>('/cart/login', {
      email,
      password
    });
    return response.data || response;
  }

  async createAccount(email: string, password: string): Promise<{ authenticated: boolean; message?: string }> {
    const response = await this.api.post<any>('/cart/create-account', {
      email,
      password
    });
    return response.data || response;
  }
  
  // Legacy method for backward compatibility
  async sendLoginLink(email: string): Promise<{ success: boolean; message?: string }> {
    const result = await this.sendAuth(email);
    return {
      success: result.auth_sent,
      message: result.message
    };
  }

  async applyDiscount(code: string): Promise<{ message: string; cart: Cart }> {
    const response = await this.api.post<any>('/cart/discount', { code });
    return { message: response.message, cart: response.cart || response.data?.cart };
  }

  async removeDiscount(): Promise<{ message: string; cart: Cart }> {
    const response = await this.api.delete<any>('/cart/discount');
    return { message: response.message, cart: response.cart || response.data?.cart };
  }

  async getPaymentMethods(): Promise<{ paymentMethods: any[]; testMode: boolean }> {
    const response = await this.api.get<any>('/payment-methods');
    const data = response.data || response;
    return {
      paymentMethods: data.payment_methods || data.paymentMethods || [],
      testMode: data.test_mode ?? data.testMode ?? false,
    };
  }

  async checkout(options: {
    gateway: string;
    manualPaymentMethodId?: string;
    locale?: string;
    returnUrl?: string;
    cancelUrl?: string;
    agreeToTerms?: boolean;
    marketingOptIn?: boolean;
    notes?: string;
  }): Promise<{ order: any }> {
    const data = {
      gateway: options.gateway,
      locale: options.locale || 'en',
      ...(options.manualPaymentMethodId && { manualPaymentMethodId: options.manualPaymentMethodId }),
      ...(options.returnUrl && { returnUrl: options.returnUrl }),
      ...(options.cancelUrl && { cancelUrl: options.cancelUrl }),
      ...(options.agreeToTerms !== undefined && { agreeToTerms: options.agreeToTerms }),
      ...(options.marketingOptIn !== undefined && { marketingOptIn: options.marketingOptIn }),
      ...(options.notes && { notes: options.notes })
    };

    const response = await this.api.post<any>('/cart/checkout', data);
    return response;
  }

  // Order API methods - for post-checkout order access
  async getOrder(orderId: string): Promise<any> {
    const response = await this.api.get<any>(`/orders/${orderId}`);
    return response.data || response;
  }

  async getOrderStatus(orderId: string): Promise<{ status: string; paymentStatus?: string }> {
    const response = await this.api.get<any>(`/orders/${orderId}/status`);
    return response.data || response;
  }
}