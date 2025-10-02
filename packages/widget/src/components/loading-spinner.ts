import { html, type TemplateResult } from 'lit';

/**
 * Reusable loading spinner component
 *
 * @param size - Size of the spinner: 'sm' (16px), 'md' (24px), 'lg' (32px)
 */
export function loadingSpinner(
  size: 'sm' | 'md' | 'lg' = 'md'
): TemplateResult {
  return html`
    <span class="sr-spinner-container" aria-label="Loading">
      <span class="sr-spinner sr-spinner-${size}"></span>
    </span>
  `;
}

/**
 * Full-page loading spinner with optional message
 */
export function loadingOverlay(message?: string): TemplateResult {
  return html`
    <div class="sr-loading-overlay">
      ${loadingSpinner('lg')}
      ${message ? html`<p class="sr-loading-message">${message}</p>` : ''}
    </div>
  `;
}