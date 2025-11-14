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
  
  // Legacy method for backward compatibility
  async sendLoginLink(email: string): Promise<{ success: boolean; message?: string }> {
    const result = await this.sendAuth(email);
    return {
      success: result.auth_sent,
      message: result.message
    };
  }

  async checkout(options?: {
    payment_method_type?: string;
    locale?: string;
    return_url?: string;
    cancel_url?: string;
  }): Promise<{ order: any }> {
    const data = {
      payment_method_type: options?.payment_method_type || 'card',
      locale: options?.locale || 'en',
      ...(options?.return_url && { return_url: options.return_url }),
      ...(options?.cancel_url && { cancel_url: options.cancel_url })
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