declare module '@shoprocket/core' {
  export interface ApiConfig {
    baseURL?: string;
    apiUrl?: string;
    publishableKey?: string;
    publicKey?: string;
    locale?: string;
    sessionToken?: string;
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
    get(id: string): Promise<any>;
  }

  export class CartService {
    constructor(api: ApiClient);
    get(): Promise<any>;
    addItem(data: { product_id: string; quantity: number; variant_id?: string }): Promise<any>;
    updateItem(itemId: string, quantity: number): Promise<any>;
    removeItem(itemId: string): Promise<any>;
    clear(): Promise<any>;
  }

  export class ShoprocketCore {
    api: ApiClient;
    session: SessionService;
    store: StoreService;
    products: ProductsService;
    cart: CartService;
    
    constructor(config: ApiConfig);
    initialize(): Promise<void>;
    setSessionToken(token: string): void;
    getApiUrl(): string;
  }

  export default ShoprocketCore;
}