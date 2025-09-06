/**
 * Shoprocket Widget
 * 
 * Copyright (c) 2025 Shoprocket Ltd.
 * 
 * This source code is proprietary and confidential.
 * Unauthorized copying or distribution is strictly prohibited.
 * 
 * @license Proprietary
 */

import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ShoprocketCore } from '@shoprocket/core';
import './styles.css';
// Import SVG as string - Vite will inline it at build time
import shoppingBasketIcon from './assets/icons/shopping-basket.svg?raw';

// Types
interface WidgetConfig {
  publicKey?: string;
  apiUrl?: string;
  locale?: string;
  currency?: string;
}

interface MountOptions {
  storeId: string;
  [key: string]: any;
}

// Global widget manager
class ShoprocketWidget {
  private sdk: ShoprocketCore | null = null;
  private initialized = false;
  private mountedWidgets = new Map<Element, LitElement>();

  /**
   * Initialize the widget with a public key
   */
  async init(publicKey: string, options: WidgetConfig = {}): Promise<void> {
    if (this.initialized) {
      console.warn('Shoprocket: Already initialized');
      return;
    }

    try {
      // Initialize SDK
      this.sdk = new ShoprocketCore({
        publicKey,
        apiUrl: options.apiUrl,
      });

      // Check for existing session in localStorage
      const storedToken = localStorage.getItem('shoprocket_session_token');
      if (storedToken) {
        this.sdk.setSessionToken(storedToken);
        console.log('Shoprocket: Using existing session token');
      } else {
        // Create new session
        const session = await this.sdk.session.create();
        const sessionToken = (session as any).session?.session_token || (session as any).session_token;
        if (sessionToken) {
          this.sdk.setSessionToken(sessionToken);
          localStorage.setItem('shoprocket_session_token', sessionToken);
          console.log('Shoprocket: Created new session');
        }
      }

      // Get store info
      const store = await this.sdk.store.get();
      const storeName = (store as any).data?.name || (store as any).name || 'Unknown';
      console.log('Shoprocket: Initialized for store:', storeName);

      this.initialized = true;

      // Auto-mount any widgets already in DOM
      this.autoMount();
    } catch (error) {
      console.error('Shoprocket: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get SDK instance
   */
  getSdk(): ShoprocketCore {
    if (!this.sdk) {
      throw new Error('Shoprocket: Not initialized. Call init() first.');
    }
    return this.sdk;
  }

  /**
   * Auto-mount widgets based on data attributes
   */
  private autoMount(): void {
    // Find all elements with data-shoprocket attribute
    const elements = document.querySelectorAll('[data-shoprocket]');
    
    elements.forEach(element => {
      const widgetType = element.getAttribute('data-shoprocket');
      if (!widgetType) return;

      // Extract all data-* attributes
      const options: Record<string, string> = {};
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('data-') && attr.name !== 'data-shoprocket') {
          const key = attr.name.replace('data-', '').replace(/-([a-z])/g, g => g[1]?.toUpperCase() || '');
          options[key] = attr.value;
        }
      });

      // Mount appropriate component
      this.mount(element, widgetType, options);
    });
  }

  /**
   * Mount a widget on an element
   */
  mount(element: Element, widgetType: string, options: Record<string, any> = {}): void {
    if (!this.initialized || !this.sdk) {
      throw new Error('Shoprocket: Not initialized. Call init() first.');
    }

    // Create appropriate component based on type
    let component: LitElement | null = null;

    switch (widgetType) {
      case 'product-grid':
      case 'products':
        component = new ProductGrid();
        break;
      case 'cart':
        component = new CartWidget();
        break;
      default:
        console.warn(`Shoprocket: Unknown widget type: ${widgetType}`);
        return;
    }

    if (component) {
      // Set properties
      Object.assign(component, options);
      (component as any).sdk = this.sdk;

      // Mount to element
      element.appendChild(component);
      this.mountedWidgets.set(element, component);
    }
  }

  /**
   * Check if legacy embed
   */
  isLegacyEmbed(element: Element): boolean {
    return element.classList.contains('sr-element') && 
           !!element.querySelector('script[type="application/json"]');
  }
}

/**
 * Base class for Shoprocket components with Light DOM
 */
class ShoprocketElement extends LitElement {
  @property({ attribute: false })
  sdk!: ShoprocketCore;

  // Use Light DOM instead of Shadow DOM
  protected createRenderRoot(): HTMLElement {
    return this;
  }

  protected getMediaUrl(media: any, transformations?: string): string {
    // Get base URL from SDK config
    const apiUrl = this.sdk.getApiUrl();
    const baseUrl = apiUrl.replace('/api/v3', '');
    
    // Return placeholder if no media provided
    if (!media) {
      return `${baseUrl}/img/placeholder.svg`;
    }
    
    // If media has a direct URL, use it
    if (media.url) {
      return media.url;
    }
    
    // Otherwise construct the URL
    const mediaUrl = `${baseUrl}/media`;
    const transforms = transformations || media.transformations || 'w=600,h=800,fit=cover';
    const path = media.path || media.id;
    const filename = media.filename || media.name || '';
    
    return `${mediaUrl}/${transforms}/${path}/${filename}`;
  }

  protected handleImageError(e: Event): void {
    const img = e.target as HTMLImageElement;
    const apiUrl = this.sdk.getApiUrl();
    const baseUrl = apiUrl.replace('/api/v3', '');
    img.src = `${baseUrl}/img/placeholder.svg`;
  }

  /**
   * Wrapper for API calls that automatically manages loading states
   */
  protected async withLoading<T>(action: string, fn: () => Promise<T>): Promise<T> {
    // Set loading state
    this.loading = true;
    try {
      const result = await fn();
      return result;
    } finally {
      // Clear loading state after a minimum time to prevent flicker
      setTimeout(() => {
        this.loading = false;
      }, 300);
    }
  }

  protected formatPrice(price: any): string {
    if (typeof price === 'object' && price !== null) {
      const cents = price.amount || price.amount_cents || 0;
      return `$${(cents / 100).toFixed(2)}`;
    }
    return `$${(price / 100).toFixed(2)}`;
  }
  
  private getDisplayMedia(): any {
    // If we have a selected variant with a specific media_id, find and use that media
    if (this.selectedVariant?.media_id && this.selectedProduct?.media) {
      const variantMedia = this.selectedProduct.media.find((m: any) => m.id === this.selectedVariant.media_id);
      if (variantMedia) {
        return variantMedia;
      }
    }
    // Fall back to the first product media (same as shown in list)
    return this.selectedProduct?.media?.[0];
  }
  
  private getSelectedMedia(): any {
    // Return media based on selected index
    return this.selectedProduct?.media?.[this.selectedMediaIndex] || this.getDisplayMedia();
  }
}

/**
 * Product Grid Component
 */
@customElement('shoprocket-product-grid')
class ProductGrid extends ShoprocketElement {
  @property({ type: String, attribute: 'store-id' })
  storeId!: string;

  @property({ type: String })
  category?: string;

  @property({ type: Number })
  limit = 12;

  @state()
  private products: any[] = [];

  @state()
  private loading = true;

  @state()
  private error?: string;

  @state()
  private selectedProduct?: any;

  @state()
  private selectedOptions: { [optionId: string]: string } = {};

  @state()
  private selectedVariant?: any;

  @state()
  private currentView: 'list' | 'product' = 'list';
  
  @state()
  private selectedMediaIndex: number = 0;
  
  private handleHashChange = async (): Promise<void> => {
    if (window.location.hash.startsWith('#!/')) {
      const slug = window.location.hash.substring(3);
      const product = this.products.find(p => p.slug === slug);
      if (product && (!this.selectedProduct || this.selectedProduct.slug !== slug)) {
        await this.showProductDetail(product);
      }
    } else if (this.currentView === 'product') {
      this.backToList();
    }
  };

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this.loadProducts();
    
    // Check if URL has a product hash on load
    if (window.location.hash.startsWith('#!/')) {
      const slug = window.location.hash.substring(3);
      const product = this.products.find(p => p.slug === slug);
      if (product) {
        await this.showProductDetail(product);
      }
    }
    
    // Listen for hash changes
    window.addEventListener('hashchange', this.handleHashChange);
  }
  
  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.handleHashChange);
  }

  private async loadProducts(): Promise<void> {
    try {
      this.loading = true;
      const response = await this.sdk.products.list({
        per_page: this.limit,
        category: this.category,
      });

      this.products = (response as any).data || [];
      this.error = undefined;
    } catch (err) {
      console.error('Failed to load products:', err);
      this.error = 'Failed to load products';
      this.products = [];
    } finally {
      this.loading = false;
    }
  }

  protected render(): TemplateResult {
    if (this.loading && !this.products.length && !this.selectedProduct) {
      return html`<div class="sr:text-center sr:py-8 sr:text-gray-600">Loading products...</div>`;
    }

    if (this.error) {
      return html`<div class="sr:text-center sr:py-8 sr:text-red-600">${this.error}</div>`;
    }

    if (this.currentView === 'product' && this.selectedProduct) {
      return html`
        <div class="sr:relative">
          ${this.loading ? html`
            <div class="sr:absolute sr:inset-0 sr:bg-white/75 sr:flex sr:items-center sr:justify-center sr:z-40 sr:rounded-lg">
              <div class="sr:flex sr:flex-col sr:items-center sr:gap-2">
                <div class="sr:animate-spin sr:rounded-full sr:h-8 sr:w-8 sr:border-2 sr:border-gray-300 sr:border-t-black"></div>
                <div class="sr:text-sm sr:text-gray-600">Loading...</div>
              </div>
            </div>
          ` : ''}
          ${this.renderProductView()}
        </div>
      `;
    }

    return html`
      <div class="sr sr:grid sr:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sr:gap-4 md:sr:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:sr:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:sr:gap-2" data-sr>
        ${this.products.map(product => html`
          <article class="sr:border sr:border-gray-200 sr:rounded-lg sr:p-4 sr:text-center sm:sr:p-3">
            <div class="sr:w-full sr:h-[200px] sm:sr:h-[150px] sr:rounded sr:mb-2 sr:overflow-hidden sr:bg-gray-100">
              <img 
                src="${this.getMediaUrl(product.media?.[0])}" 
                alt="${product.name}" 
                class="sr:w-full sr:h-full sr:object-cover"
                @error="${(e: Event) => this.handleImageError(e)}"
              >
            </div>
            <h3 class="sr:text-lg sr:my-2">${product.name}</h3>
            <p class="sr:text-xl sr:font-bold sr:text-gray-800 sr:my-2">${this.formatPrice(product.price)}</p>
            <button 
              class="sr:bg-black sr:text-white sr:border-none sr:py-2 sr:px-4 sr:rounded sr:cursor-pointer sr:text-base sr:w-full sr:transition-opacity sr:duration-200 ${this.loading ? 'sr:opacity-50 sr:cursor-wait' : ''}"
              @click="${() => this.addToCart(product.id)}"
              ?disabled="${this.loading}"
            >
              Add to Cart
            </button>
          </article>
        `)}
      </div>
    `;
  }

  private async addToCart(productId: string): Promise<void> {
    try {
      // Find the product to check if it's quick add eligible
      const product = this.products.find(p => p.id === productId);
      
      if (!product?.quick_add_eligible) {
        // For multi-variant products, show product detail modal
        await this.showProductDetail(product);
        return;
      }

      // Prepare request data
      const requestData: any = {
        product_id: productId,
        quantity: 1
      };

      // Include variant ID for single-variant products
      if (product.default_variant_id) {
        requestData.variant_id = product.default_variant_id;
      }

      await this.sdk.cart.addItem(requestData);
      
      // Dispatch event
      this.dispatchEvent(new CustomEvent('shoprocket:cart:updated', {
        bubbles: true,
        composed: true,
        detail: { productId }
      }));

      console.log('Added to cart:', productId);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  }

  private async showProductDetail(product: any): Promise<void> {
    this.loading = true;
    try {
      // Load full product details with variants and options
      const response = await this.sdk.products.get(product.id, ['variants', 'options', 'options.values', 'media', 'displayVariant.media']);
      
      this.selectedProduct = response;
      this.selectedOptions = {};
      this.selectedVariant = null;
      this.selectedMediaIndex = 0; // Reset to first media
      this.currentView = 'product';
      
      // Update URL hash with product slug
      window.location.hash = `!/${response.slug || response.id}`;
      
      // If single variant, pre-select it
      if (this.selectedProduct.variants?.length === 1) {
        this.selectedVariant = this.selectedProduct.variants[0];
      }
    } catch (error) {
      console.error('Failed to load product details:', error);
    } finally {
      this.loading = false;
    }
  }

  private backToList(): void {
    this.currentView = 'list';
    // Clear URL hash
    window.location.hash = '';
  }

  private closeProductDetail(): void {
    this.selectedProduct = undefined;
    this.selectedOptions = {};
    this.selectedVariant = undefined;
    this.currentView = 'list';
    
    // Clear URL hash
    window.location.hash = '';
  }

  private selectOption(optionId: string, valueId: string): void {
    this.selectedOptions = { ...this.selectedOptions, [optionId]: valueId };
    this.updateSelectedVariant();
  }

  private updateSelectedVariant(): void {
    if (!this.selectedProduct?.variants) return;

    // Find variant that matches all selected options
    const selectedOptionValues = Object.values(this.selectedOptions);
    
    this.selectedVariant = this.selectedProduct.variants.find((variant: any) => {
      const variantOptionValues = variant.option_values || variant.option_value_ids || [];
      return selectedOptionValues.every(valueId => variantOptionValues.includes(valueId));
    });
    
    // If variant has specific media, find its index and select it
    if (this.selectedVariant?.media_id && this.selectedProduct?.media) {
      const mediaIndex = this.selectedProduct.media.findIndex((m: any) => m.id === this.selectedVariant.media_id);
      if (mediaIndex !== -1) {
        this.selectedMediaIndex = mediaIndex;
      }
    }
  }

  private canAddToCart(): boolean {
    if (!this.selectedProduct) return false;
    
    // For single variant products, always can add
    if (this.selectedProduct.variants?.length === 1) return true;
    
    // For multi-variant, need all options selected
    if (!this.selectedProduct.options) return false;
    
    return this.selectedProduct.options.every((option: any) => 
      this.selectedOptions[option.id]
    );
  }

  private async addSelectedToCart(): Promise<void> {
    if (!this.canAddToCart()) return;

    this.loading = true;
    try {
      const variantId = this.selectedVariant?.id || this.selectedProduct?.default_variant_id;
      if (!variantId) {
        console.error('No variant selected');
        return;
      }

      await this.sdk.cart.addItem({
        product_id: this.selectedProduct.id,
        variant_id: variantId,
        quantity: 1
      });

      // Dispatch event
      this.dispatchEvent(new CustomEvent('shoprocket:cart:updated', {
        bubbles: true,
        composed: true,
        detail: { productId: this.selectedProduct.id }
      }));

      // Close modal and show success
      this.closeProductDetail();
      console.log('Added to cart:', this.selectedProduct.id);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      this.loading = false;
    }
  }

  private getSelectedPrice(): number {
    if (!this.selectedProduct) return 0;
    return this.selectedVariant?.price?.amount || this.selectedProduct.price?.amount || 0;
  }

  private renderProductView(): TemplateResult {
    if (!this.selectedProduct) return html``;

    return html`
      <div class="sr" data-sr>
        <!-- Back Button -->
        <button class="sr:mb-6 sr:text-blue-600 hover:sr:text-blue-800 sr:bg-transparent sr:border-none sr:cursor-pointer sr:text-base sr:font-medium" @click="${() => this.backToList()}">
          ← Back to Products
        </button>
        
        <!-- Product Details - Full width, no modal styling -->
        <div class="sr:w-full">
          <div class="sr:grid sr:grid-cols-1 sr:lg:grid-cols-2 sr:gap-4 sr:lg:gap-8">
            <!-- Product Images - Left side on desktop -->
            <div>
              <div class="sr:sticky sr:top-6">
                <!-- Main image -->
                <img 
                  src="${this.getMediaUrl(this.getSelectedMedia())}" 
                  alt="${this.selectedProduct.name}"
                  class="sr:w-full sr:rounded-lg sr:mb-4"
                  @error="${(e: Event) => this.handleImageError(e)}"
                >
                
                <!-- Thumbnail gallery -->
                ${this.selectedProduct.media?.length > 1 ? html`
                  <div class="sr:grid sr:grid-cols-4 sr:gap-2">
                    ${this.selectedProduct.media.map((media: any, index: number) => html`
                      <button
                        class="sr:relative sr:aspect-square sr:rounded sr:overflow-hidden sr:border-2 ${index === this.selectedMediaIndex ? 'sr:border-black' : 'sr:border-transparent'} sr:p-0 sr:cursor-pointer"
                        @click="${() => this.selectedMediaIndex = index}"
                      >
                        <img 
                          src="${this.getMediaUrl(media, 'w=150,h=150,fit=cover')}" 
                          alt="${this.selectedProduct.name} ${index + 1}"
                          class="sr:w-full sr:h-full sr:object-cover"
                          @error="${(e: Event) => this.handleImageError(e)}"
                        >
                      </button>
                    `)}
                  </div>
                ` : ''}
              </div>
            </div>
            
            <!-- Product Info - Right side on desktop -->
            <div>
              <h1 class="sr:text-3xl sr:font-bold sr:mb-4 sr:m-0">${this.selectedProduct.name}</h1>
              
              <div class="sr:text-3xl sr:font-bold sr:mb-6 sr:text-gray-900">${this.formatPrice({ amount: this.getSelectedPrice() })}</div>
              
              ${this.selectedProduct.summary ? html`
                <p class="sr:text-gray-600 sr:mb-6 sr:text-base sr:leading-relaxed">${this.selectedProduct.summary}</p>
              ` : ''}
              
              <!-- Variant Options -->
              ${this.selectedProduct.options?.length > 0 ? html`
                <div class="sr:space-y-6">
                  ${this.selectedProduct.options.map((option: any) => html`
                    <div>
                      <label class="sr:block sr:font-medium sr:text-gray-900 sr:mb-3 sr:text-sm sr:uppercase sr:tracking-wide">${option.name}</label>
                      <div class="sr:flex sr:flex-wrap sr:gap-3">
                        ${option.values.map((value: any) => html`
                          <button 
                            class="${this.selectedOptions[option.id] === value.id ? 'sr:bg-black sr:text-white sr:border-black' : 'sr:bg-white sr:text-gray-900 sr:border-gray-300 hover:sr:border-gray-400'} sr:px-6 sr:py-3 sr:rounded sr:border sr:cursor-pointer sr:font-medium sr:transition-colors sr:duration-200 sr:text-sm"
                            @click="${() => this.selectOption(option.id, value.id)}"
                          >
                            ${value.value}
                          </button>
                        `)}
                      </div>
                    </div>
                  `)}
                </div>
              ` : ''}
              
              <!-- Add to Cart Section -->
              <div class="sr:mt-8 sr:space-y-4">
                <button 
                  class="${this.canAddToCart() && !this.loading ? 'sr:bg-black hover:sr:bg-gray-800' : 'sr:bg-gray-300 sr:cursor-not-allowed'} sr:text-white sr:border-none sr:py-4 sr:px-8 sr:rounded-lg sr:w-full sr:text-base sr:font-semibold sr:transition-colors sr:duration-200 ${this.loading ? 'sr:opacity-75' : ''}"
                  @click="${() => this.addSelectedToCart()}"
                  ?disabled="${!this.canAddToCart() || this.loading}"
                >
                  ${this.loading ? html`
                    <span class="sr:flex sr:items-center sr:justify-center sr:gap-2">
                      <span class="sr:animate-spin sr:rounded-full sr:h-4 sr:w-4 sr:border-2 sr:border-white sr:border-t-transparent"></span>
                      Adding...
                    </span>
                  ` : this.canAddToCart() ? 'Add to Cart' : 'Select All Options'}
                </button>
                
                <!-- Product Description -->
                ${this.selectedProduct.description ? html`
                  <div class="sr:mt-8 sr:pt-8 sr:border-t sr:border-gray-200">
                    <h3 class="sr:text-lg sr:font-semibold sr:mb-4 sr:m-0">Description</h3>
                    <div class="sr:text-gray-600 sr:leading-relaxed sr:text-base sr:[&_p]:mb-4 sr:[&_p:last-child]:mb-0 sr:[&_ul]:list-disc sr:[&_ul]:pl-6 sr:[&_ul]:mb-4 sr:[&_ol]:list-decimal sr:[&_ol]:pl-6 sr:[&_ol]:mb-4 sr:[&_li]:mb-1">
                      ${unsafeHTML(this.selectedProduct.description)}
                    </div>
                  </div>
                ` : ''}
                
                <!-- Additional product info -->
                <div class="sr:text-sm sr:text-gray-500 sr:text-center sr:mt-6">
                  Free shipping on orders over $50
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Cart Widget Component
 */
@customElement('shoprocket-cart')
class CartWidget extends ShoprocketElement {
  @property({ type: String })
  position = 'bottom-right';

  @property({ type: String })
  style = 'bubble';

  @state()
  private isOpen = false;

  @state()
  private cart: any = null;

  @state()
  private loading = true;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this.loadCart();

    // Listen for cart updates
    this.handleCartUpdate = this.handleCartUpdate.bind(this);
    window.addEventListener('shoprocket:cart:updated', this.handleCartUpdate);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('shoprocket:cart:updated', this.handleCartUpdate);
  }

  private handleCartUpdate = async (): Promise<void> => {
    await this.loadCart();
  }

  private async loadCart(): Promise<void> {
    try {
      this.loading = true;
      const response = await this.sdk.cart.get();
      this.cart = (response as any).data || response;
    } catch (err) {
      console.error('Failed to load cart:', err);
      this.cart = null;
    } finally {
      this.loading = false;
    }
  }

  protected render(): TemplateResult {
    const itemCount = this.cart?.items?.length || 0;

    return html`
      <div class="sr:fixed sr:z-[9999] ${this.getPositionClasses()}" data-sr>
        <button 
          class="${this.getTriggerClasses()}"
          @click="${() => this.isOpen = !this.isOpen}"
        >
          ${this.renderTriggerContent(itemCount)}
        </button>

        ${this.isOpen ? html`
          <div class="sr:fixed sr:bg-white sr:rounded sr:shadow-lg sr:w-96 sr:max-w-[calc(100vw-2rem)] sr:max-h-[80vh] sr:flex sr:flex-col ${this.getPanelPositionClasses()} sm:sr:w-full sm:sr:max-w-full sm:sr:bottom-0 sm:sr:start-0 sm:sr:end-0 sm:sr:rounded-t-2xl sm:sr:rounded-b-none sm:sr:max-h-[70vh]">
            <div class="sr:p-4 sr:border-b sr:border-gray-200 sr:flex sr:justify-between sr:items-center">
              <h3 class="sr:m-0 sr:text-xl">Your Cart</h3>
              <button class="sr:bg-transparent sr:border-none sr:text-2xl sr:cursor-pointer sr:text-gray-600 sr:p-0 sr:w-8 sr:h-8 sr:flex sr:items-center sr:justify-center" @click="${() => this.isOpen = false}">×</button>
            </div>
            <div class="sr:flex-1 sr:overflow-y-auto sr:p-4">
              ${this.renderCartItems()}
            </div>
            <div class="sr:p-4 sr:border-t sr:border-gray-200">
              <div class="sr:text-lg sr:font-bold sr:mb-4">
                Total: ${this.formatPrice(this.cart?.totals?.total || 0)}
              </div>
              <button class="sr:bg-black sr:text-white sr:border-none sr:py-3 sr:px-6 sr:rounded sr:w-full sr:cursor-pointer sr:text-base sr:font-medium sr:transition-opacity sr:duration-200">
                Checkout
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderCartItems(): TemplateResult {
    if (!this.cart?.items?.length) {
      return html`<p class="sr:text-center sr:text-gray-600 sr:py-8">Your cart is empty</p>`;
    }

    return html`
      ${this.cart.items.map((item: any) => html`
        <div class="sr:flex sr:gap-3 sr:py-3 sr:border-b sr:border-gray-100 last:sr:border-b-0">
          <!-- Product Image -->
          <div class="sr:w-16 sr:h-16 sr:flex-shrink-0 sr:rounded sr:overflow-hidden sr:bg-gray-100">
            <img 
              src="${this.getMediaUrl(item.media?.[0], 'w=128,h=128,fit=cover')}" 
              alt="${item.product_name}"
              class="sr:w-full sr:h-full sr:object-cover"
              @error="${(e: Event) => this.handleImageError(e)}"
            >
          </div>
          
          <!-- Product Details -->
          <div class="sr:flex-1 sr:min-w-0">
            <div class="sr:font-medium sr:text-sm sr:mb-1 sr:truncate">${item.product_name}</div>
            <div class="sr:text-gray-600 sr:text-sm">${this.formatPrice(item.price)}</div>
            ${item.variant_name ? html`
              <div class="sr:text-gray-500 sr:text-xs">${item.variant_name}</div>
            ` : ''}
          </div>
          
          <!-- Quantity Controls -->
          <div class="sr:flex sr:flex-col sr:items-end sr:gap-2">
            <button 
              class="sr:text-gray-400 sr:text-sm sr:p-0 sr:bg-transparent sr:border-none sr:cursor-pointer sr:transition-colors sr:duration-200 hover:sr:text-red-600"
              @click="${() => this.removeItem(item.id)}"
              aria-label="Remove item"
            >✕</button>
            
            <div class="sr:flex sr:items-center sr:gap-1 sr:bg-gray-100 sr:rounded sr:px-1">
              <button 
                class="sr:w-6 sr:h-6 sr:bg-transparent sr:border-none sr:cursor-pointer sr:text-gray-600 sr:flex sr:items-center sr:justify-center sr:transition-colors sr:duration-200 hover:sr:text-black ${item.quantity === 1 ? 'sr:opacity-50 sr:cursor-not-allowed' : ''}"
                @click="${() => this.updateQuantity(item.id, item.quantity - 1)}"
                ?disabled="${item.quantity === 1}"
                aria-label="Decrease quantity"
              >−</button>
              <span class="sr:text-sm sr:font-medium sr:w-8 sr:text-center">${item.quantity}</span>
              <button 
                class="sr:w-6 sr:h-6 sr:bg-transparent sr:border-none sr:cursor-pointer sr:text-gray-600 sr:flex sr:items-center sr:justify-center sr:transition-colors sr:duration-200 hover:sr:text-black"
                @click="${() => this.updateQuantity(item.id, item.quantity + 1)}"
                aria-label="Increase quantity"
              >+</button>
            </div>
          </div>
        </div>
      `)}
    `;
  }

  private async updateQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity < 1) return;
    
    try {
      await this.sdk.cart.updateItem(itemId, { quantity });
      await this.loadCart();
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  }

  private async removeItem(itemId: string): Promise<void> {
    try {
      await this.sdk.cart.removeItem(itemId);
      await this.loadCart();
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  }

  private getPositionClasses(): string {
    switch (this.position) {
      case 'bottom-left':
        return 'sr:bottom-5 sr:start-5';
      case 'middle-right':
        return 'sr:top-1/2 sr:end-0 sr:-translate-y-1/2';
      case 'middle-left':
        return 'sr:top-1/2 sr:start-0 sr:-translate-y-1/2';
      default: // bottom-right
        return 'sr:bottom-5 sr:end-5';
    }
  }

  private getPanelPositionClasses(): string {
    switch (this.position) {
      case 'bottom-left':
        return 'sr:bottom-[100px] sr:start-5';
      case 'middle-right':
        return 'sr:top-1/2 sr:end-5 sr:-translate-y-1/2';
      case 'middle-left':
        return 'sr:top-1/2 sr:start-5 sr:-translate-y-1/2';
      default: // bottom-right
        return 'sr:bottom-[100px] sr:end-5';
    }
  }

  private getTriggerClasses(): string {
    const isMiddle = this.position.includes('middle');
    
    if (isMiddle) {
      const baseClasses = 'sr:bg-white sr:text-black sr:border-none sr:cursor-pointer sr:relative sr:shadow-sm sr:transition-all sr:duration-200 sr:flex sr:items-center sr:justify-center';
      const sizeClasses = 'sr:w-[var(--sr-cart-tab-width)] sr:h-[var(--sr-cart-tab-height)]';
      const roundingClasses = this.position === 'middle-right' 
        ? 'sr:rounded-s sr:rounded-e-none' 
        : 'sr:rounded-e sr:rounded-s-none';
      return `${baseClasses} ${sizeClasses} ${roundingClasses} sr:flex-col sr:py-2 sr:gap-1`;
    }
    
    // Bottom positions - circular button
    return 'sr:bg-white sr:text-black sr:border-none sr:rounded sr:w-[var(--sr-cart-size)] sr:h-[var(--sr-cart-size)] sr:flex sr:items-center sr:justify-center sr:cursor-pointer sr:relative sr:shadow-md sr:transition-transform sr:duration-200 sm:sr:w-[var(--sr-cart-size-sm)] sm:sr:h-[var(--sr-cart-size-sm)]';
  }

  private renderTriggerContent(itemCount: number): TemplateResult {
    const isMiddle = this.position.includes('middle');
    
    if (isMiddle) {
      return html`
        <div class="sr:flex sr:flex-col sr:items-center sr:justify-center sr:gap-1">
          ${itemCount > 0 ? html`
            <span class="sr:text-sm sr:font-bold">${itemCount}</span>
          ` : ''}
          <span class="sr:w-6 sr:h-6 sr-icon sr:flex" aria-hidden="true">${unsafeHTML(shoppingBasketIcon)}</span>
        </div>
      `;
    }
    
    // Bottom positions - standard layout
    return html`
      <span class="sr:w-6 sr:h-6 sr-icon sr:flex sr:items-center sr:justify-center" aria-hidden="true">${unsafeHTML(shoppingBasketIcon)}</span>
      ${itemCount > 0 ? html`
        <span class="sr:absolute sr:-top-2 sr:-end-2 sr:bg-black sr:text-white sr:rounded-full sr:w-5 sr:h-5 sr:flex sr:items-center sr:justify-center sr:text-xs sr:font-bold">${itemCount}</span>
      ` : ''}
    `;
  }
}

// Inject stylesheet link
function injectStyles(): void {
  const linkId = 'shoprocket-widget-styles';
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    
    // Get base URL from captured script URL
    if (scriptUrl) {
      const url = new URL(scriptUrl);
      link.href = url.origin + url.pathname.replace('shoprocket.js', 'style.css');
    } else {
      // Fallback to relative path
      link.href = 'style.css';
    }
    
    document.head.appendChild(link);
  }
}

// Capture script info immediately while currentScript is available
const scriptUrl = (document.currentScript as HTMLScriptElement)?.src || '';

// Create global instance
const shoprocket = new ShoprocketWidget();

// Expose to window
(window as any).Shoprocket = shoprocket;

/**
 * Get public key from script URL
 */
function getPublicKey(): string | null {
  if (scriptUrl) {
    const url = new URL(scriptUrl);
    const pk = url.searchParams.get('pk');
    if (pk) return pk;
  }
  return null;
}

/**
 * Auto-detect API URL based on script source
 */
function getApiUrl(): string {
  // Default to production
  let apiUrl = 'https://api.shoprocket.io/api/v3';
  
  if (scriptUrl) {
    const scriptHost = new URL(scriptUrl).hostname;
    
    // Detect environment based on script host
    if (scriptHost.includes('staging') || scriptHost.includes('stage')) {
      apiUrl = 'https://api-staging.shoprocket.io/api/v3';
    } else if (scriptHost.includes('localhost') || scriptHost.includes('.test') || scriptHost.includes('.local')) {
      apiUrl = 'https://shoprocketv3.test/api/v3';
    }
  }
  
  return apiUrl;
}

/**
 * Initialize when DOM is ready
 */
function autoInit(): void {
  // Inject styles first
  injectStyles();
  
  const publicKey = getPublicKey();
  
  if (!publicKey) {
    console.warn('Shoprocket: No public key found. Please provide one via URL param (?pk=xxx)');
    return;
  }
  
  const apiUrl = getApiUrl();
  
  console.log('Shoprocket: Auto-initializing with config:', { publicKey, apiUrl });
  shoprocket.init(publicKey, { apiUrl }).catch(console.error);
}

// Auto-initialize on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit);
} else {
  autoInit();
}

// Export for module usage
export { ShoprocketWidget, ShoprocketElement, ProductGrid, CartWidget };