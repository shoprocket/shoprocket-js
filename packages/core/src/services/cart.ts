import { ApiClient } from '../api';

export interface CartItem {
  id: string;
  product_id: string;
  variant_id?: string;
  product_name?: string;
  price: number;
  quantity: number;
  subtotal: number;
  product_image?: {
    path: string;
  };
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  totals: CartTotals;
  currency: string;
  item_count: number;
}

export interface AddToCartData {
  product_id: string;
  quantity: number;
  variant_id?: string;
}

export interface CustomerData {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  shipping_address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country: string;
  };
  billing_address?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country: string;
  };
}

export class CartService {
  constructor(private api: ApiClient) {}

  async get(): Promise<Cart> {
    const response = await this.api.get<any>('/cart');
    return response.cart || response.data || response;
  }

  async addItem(data: AddToCartData): Promise<Cart> {
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

  async updateCustomer(customerData: CustomerData): Promise<Cart> {
    const response = await this.api.put<any>('/cart/customer', customerData);
    return response.cart || response.data || response;
  }

  async checkout(options?: {
    payment_method_type?: string;
    locale?: string;
  }): Promise<{ order: any }> {
    const data = {
      payment_method_type: options?.payment_method_type || 'card',
      locale: options?.locale || 'en'
    };
    
    const response = await this.api.post<any>('/cart/checkout', data);
    return response;
  }
}