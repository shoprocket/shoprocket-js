import { LitElement, CSSResultGroup } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketCore } from '@shoprocket/core';
import { formatPrice, getMediaUrl, handleImageError, dispatchCartEvents } from '../utils/formatters';
import { sharedStyles, sharedStylesheet } from './shared-styles';
import { baseStyles } from './base-styles';
import { EVENTS } from './analytics';

/**
 * Base class for Shoprocket components with Shadow DOM
 */
export class BaseComponent extends LitElement {
  // Apply shared styles to all components
  // Base styles reset font-size to prevent parent page scaling
  static override styles: CSSResultGroup = [baseStyles, sharedStyles];
  
  // Use constructable stylesheets for better performance
  protected override createRenderRoot(): HTMLElement | ShadowRoot {
    const root = super.createRenderRoot() as HTMLElement | ShadowRoot;
    
    // Adopt the shared stylesheet if the browser supports it
    if ('adoptedStyleSheets' in root) {
      (root as any).adoptedStyleSheets = [sharedStylesheet];
    }
    
    return root;
  }
  @property({ attribute: false })
  sdk!: ShoprocketCore;

  @state()
  private loadingStates = new Map<string, boolean>();

  @state()
  protected errorMessage: string | null = null;

  @state()
  protected successMessage: string | null = null;

  // Shadow DOM is enabled by default in Lit
  // To use Light DOM, override createRenderRoot() to return this

  protected async withLoading(key: string, fn: () => Promise<unknown>): Promise<void> {
    this.loadingStates.set(key, true);
    this.requestUpdate();
    try {
      await fn();
    } finally {
      this.loadingStates.set(key, false);
      this.requestUpdate();
    }
  }

  protected isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }

  // Delegate to utility functions to avoid duplication
  protected getMediaUrl(media: Parameters<typeof getMediaUrl>[1], transformations?: string): string {
    return getMediaUrl(this.sdk, media, transformations);
  }

  protected handleImageError(e: Event): void {
    handleImageError(this.sdk, e);
  }
  
  protected dispatchCartEvents(product: any, variantId?: string, variantText?: string | null): void {
    dispatchCartEvents(this, product, variantId, variantText);
  }

  protected formatPrice(price: Parameters<typeof formatPrice>[0]): string {
    return formatPrice(price);
  }

  /**
   * Show an error message to the user
   */
  protected showError(message: string, duration: number = 5000): void {
    this.errorMessage = message;
    if (duration > 0) {
      setTimeout(() => {
        this.errorMessage = null;
      }, duration);
    }
  }

  /**
   * Clear any error message
   */
  protected clearError(): void {
    this.errorMessage = null;
  }

  /**
   * Show a success message to the user
   */
  protected showSuccess(message: string, duration: number = 3000): void {
    this.successMessage = message;
    if (duration > 0) {
      setTimeout(() => {
        this.successMessage = null;
      }, duration);
    }
  }

  /**
   * Track any event with minimal code using entity-based tracking
   */
  protected track(eventName: string, entity?: any, extra?: any): void {
    const analytics = (window as any).Shoprocket?.analytics;
    if (analytics?.trackEntity) {
      analytics.trackEntity(eventName, entity, extra);
    }
  }

  /**
   * Get the store currency
   */
  protected getStoreCurrency(): string {
    return (window as any).ShoprocketWidget?.store?.currency || 'USD';
  }
}

// Re-export as ShoprocketElement for backwards compatibility
export { BaseComponent as ShoprocketElement };

// Re-export EVENTS for easy access in all components
export { EVENTS };