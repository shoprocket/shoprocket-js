import { LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketCore } from '@shoprocket/core';
import { formatPrice, getMediaUrl, handleImageError } from '../utils/formatters';

/**
 * Base class for Shoprocket components with Light DOM
 */
export class BaseComponent extends LitElement {
  @property({ attribute: false })
  sdk!: ShoprocketCore;

  @state()
  private loadingStates = new Map<string, boolean>();

  @state()
  protected errorMessage: string | null = null;

  @state()
  protected successMessage: string | null = null;

  // Use Light DOM instead of Shadow DOM
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

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
}

// Re-export as ShoprocketElement for backwards compatibility
export { BaseComponent as ShoprocketElement };