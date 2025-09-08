import { html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import type { Product } from '../types/api';
import './product-list';
import './product-detail';

/**
 * Product Grid Component - Orchestrates between list and detail views
 */
@customElement('shoprocket-product-grid')
export class ProductGrid extends ShoprocketElement {
  @property({ type: String, attribute: 'store-id' })
  storeId!: string;

  @property({ type: String })
  category?: string;

  @property({ type: Number })
  limit = 12;

  @state()
  private selectedProduct?: Product;

  @state()
  private currentView: 'list' | 'product' = 'list';

  private savedScrollPosition = 0;

  private handleHashChange = (): void => {
    if (window.location.hash.startsWith('#!/')) {
      const hashPath = window.location.hash.substring(3);
      // Extract just the product slug (before /~/cart if present)
      const slug = hashPath.split('/~/')[0];
      // Find product by slug if we have a list reference
      const listElement = this.querySelector('shoprocket-product-list') as any;
      if (listElement?.products) {
        const product = listElement.products.find((p: Product) => p.slug === slug);
        if (product) {
          this.showProductDetail(product);
        }
      }
    } else if (this.currentView === 'product') {
      this.backToList();
    }
  };

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    
    // Check if URL has a product hash on load
    if (window.location.hash.startsWith('#!/')) {
      this.currentView = 'product';
      const hashPath = window.location.hash.substring(3);
      // Extract just the product slug (before /~/cart if present)
      const slug = hashPath.split('/~/')[0];
      
      // Try to load the product directly by slug
      await this.loadProductBySlug(slug);
    }
    
    // Listen for hash changes
    window.addEventListener('hashchange', this.handleHashChange);
  }
  
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.handleHashChange);
  }

  protected override render(): TemplateResult {
    return html`
      <div class="sr" data-sr>
        <!-- Product List View -->
        <div style="${this.currentView === 'list' ? '' : 'display: none;'}">
          <shoprocket-product-list
            store-id="${this.storeId}"
            .sdk="${this.sdk}"
            .category="${this.category}"
            .limit="${this.limit}"
            @product-selected="${(e: CustomEvent) => this.showProductDetail(e.detail.product)}"
          ></shoprocket-product-list>
        </div>

        <!-- Product Detail View -->
        ${this.currentView === 'product' ? html`
          <shoprocket-product-detail
            .sdk="${this.sdk}"
            .product="${this.selectedProduct}"
            @back-to-list="${() => this.backToList()}"
          ></shoprocket-product-detail>
        ` : ''}
      </div>
    `;
  }

  private showProductDetail(product: Product): void {
    // Save current scroll position
    this.savedScrollPosition = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    
    this.selectedProduct = product;
    this.currentView = 'product';
    
    // Update URL hash with product slug
    window.location.hash = `!/${product.slug || product.id}`;
    
    // Scroll to top of the widget after render
    requestAnimationFrame(() => {
      this.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  private backToList(): void {
    this.currentView = 'list';
    this.selectedProduct = undefined;
    
    // Clear URL hash
    window.location.hash = '';
    
    // Restore scroll position after DOM updates
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({
          top: this.savedScrollPosition,
          left: 0,
          behavior: 'instant'
        });
      });
    });
  }

  private async loadProductBySlug(slug: string): Promise<void> {
    try {
      // First, try to get the product from the list if it's loaded
      const listElement = this.querySelector('shoprocket-product-list') as any;
      if (listElement?.products?.length > 0) {
        const product = listElement.products.find((p: Product) => p.slug === slug);
        if (product) {
          this.selectedProduct = product;
          return;
        }
      }

      // If not in list, we need to load products first to find it
      // This ensures the list is populated for when user goes back
      if (!listElement?.products?.length) {
        // Wait for the list to load its products
        await new Promise<void>((resolve) => {
          const checkProducts = () => {
            const list = this.querySelector('shoprocket-product-list') as any;
            if (list?.products?.length > 0) {
              const product = list.products.find((p: Product) => p.slug === slug);
              if (product) {
                this.selectedProduct = product;
              }
              resolve();
            } else {
              // Keep checking
              setTimeout(checkProducts, 100);
            }
          };
          
          // Start checking after a small delay to let the list component initialize
          setTimeout(checkProducts, 100);
        });
      }
    } catch (error) {
      console.error('Failed to load product by slug:', error);
      // If we can't load the product, go back to list
      this.backToList();
    }
  }
}