import { ApiClient } from '../api';

export interface CustomerProfile {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  hasPassword: boolean;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  createdAt: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  itemCount: number;
  total: {
    amount: number;
    currency: string;
    formatted: string;
  };
  createdAt: string;
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

export interface CustomerOrderDetail extends Omit<CustomerOrder, 'itemCount'> {
  currency: string;
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

  async getProfile(): Promise<CustomerProfile> {
    const response = await this.api.get<any>('/account/profile');
    return response.data || response;
  }

  async updateProfile(data: { firstName?: string; lastName?: string; phone?: string | null }): Promise<CustomerProfile> {
    const response = await this.api.put<any>('/account/profile', data);
    return response.data || response;
  }

  async getOrders(page = 1, perPage = 10): Promise<{ data: CustomerOrder[]; meta: PaginationMeta }> {
    const response = await this.api.get<any>(`/account/orders?page=${page}&perPage=${perPage}`);
    return {
      data: response.data || [],
      meta: response.meta || { currentPage: page, lastPage: 1, perPage, total: 0 },
    };
  }

  async getOrder(orderId: string): Promise<CustomerOrderDetail> {
    const response = await this.api.get<any>(`/account/orders/${orderId}`);
    return response.data || response;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.api.post<any>('/account/change-password', { currentPassword, newPassword });
  }

  async logout(): Promise<void> {
    await this.api.post<any>('/account/logout', {});
  }
}
