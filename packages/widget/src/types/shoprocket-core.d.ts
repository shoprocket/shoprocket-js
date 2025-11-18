declare module '@shoprocket/core' {
  export interface ApiConfig {
    baseURL?: string;
    apiUrl?: string;
    publishableKey?: string;
    publicKey?: string;
    locale?: string;
    cartToken?: string;
  }

  export interface AuthResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    user?: {
      id: string;
      email: string;
      name?: string;
    };
  }

  export interface SessionResponse {
    token: string;
    user?: any;
  }

  export interface Store {
    id: string;
    name: string;
    locale: string;
    currency: string;
  }

  export interface ApiClient {
    get<T>(path: string, params?: any): Promise<T>;
    post<T>(path: string, data?: any): Promise<T>;
    put<T>(path: string, data?: any): Promise<T>;
    delete<T>(path: string): Promise<T>;
  }

  export class SessionService {
    constructor(api: ApiClient);
    create(locale?: string): Promise<SessionResponse>;
    get(): string | null;
    set(token: string): void;
    clear(): void;
  }

  export class StoreService {
    constructor(api: ApiClient, config: ApiConfig);
    get(): Promise<Store>;
  }

  export class ProductsService {
    constructor(api: ApiClient);
    list(params?: any): Promise<any>;
    get(id: string, includes?: string[], options?: RequestInit): Promise<any>;
  }

  export class CartService {
    constructor(api: ApiClient);
    get(): Promise<any>;
    addItem(data: { product_id: string; quantity: number; variant_id?: string; source_url?: string }): Promise<any>;
    updateItem(itemId: string, quantity: number): Promise<any>;
    removeItem(itemId: string): Promise<any>;
    clear(): Promise<any>;
    updateCustomer(data: {
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      company?: string;
      shippingAddress?: any;
      billingAddress?: any; 
      same_as_billing?: boolean; 
    }): Promise<any>;
    checkout(data: { payment_method_type: string; locale: string }): Promise<any>;
  }

  export class AuthService {
    constructor(api: ApiClient);
    login(credentials: { email: string; password: string }): Promise<AuthResponse>;
    register(data: { email: string; password: string; name?: string }): Promise<AuthResponse>;
    logout(): Promise<void>;
    me(): Promise<any>;
    refresh(): Promise<AuthResponse>;
  }

  export class LocationService {
    constructor(api: ApiClient);
    getCountries(locale?: string): Promise<any>;
    getStates(countryCode: string): Promise<any>;
  }

  export class ShoprocketCore {
    api: ApiClient;
    session: SessionService;
    store: StoreService;
    products: ProductsService;
    cart: CartService;
    auth: AuthService;
    location: LocationService;
    
    constructor(config: ApiConfig);
    initialize(): Promise<void>;
    setCartToken(token: string): void;
    getApiUrl(): string;
    setAuthToken(token: string): void;
    clearAuthToken(): void;
  }

  export default ShoprocketCore;
}