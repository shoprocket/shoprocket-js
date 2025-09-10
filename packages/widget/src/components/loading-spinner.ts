import { html, type TemplateResult } from 'lit';

/**
 * Reusable loading spinner component
 * 
 * @param size - Size of the spinner: 'sm' (16px), 'md' (24px), 'lg' (32px), or custom size in pixels
 * @param color - Color class or 'currentColor' to inherit from parent
 */
export function loadingSpinner(
  size: 'sm' | 'md' | 'lg' | number = 'md'
): TemplateResult {
  // Convert size to pixels
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 32
  };
  const sizeInPx = typeof size === 'number' ? size : sizeMap[size];
  const borderWidth = Math.max(2, sizeInPx / 8);
  
  return html`
    <span class="sr-spinner-container" aria-label="Loading">
      <span 
        class="sr-spinner"
        style="
          width: ${sizeInPx}px; 
          height: ${sizeInPx}px;
          border: ${borderWidth}px solid currentColor;
          border-right-color: transparent;
          opacity: 0.25;
        "
      ></span>
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