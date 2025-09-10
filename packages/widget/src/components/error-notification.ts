import { html, type TemplateResult } from 'lit';

/**
 * Render error notification UI
 */
export function renderErrorNotification(errorMessage: string | null): TemplateResult {
  if (!errorMessage) {
    return html``;
  }

  return html`
    <div class="sr-notification sr-notification-error">
      <div class="sr-notification-content">
        <svg class="sr-notification-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="sr-notification-message">
          <p>${errorMessage}</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render success notification UI
 */
export function renderSuccessNotification(message: string | null): TemplateResult {
  if (!message) {
    return html``;
  }

  return html`
    <div class="sr-notification sr-notification-success">
      <div class="sr-notification-content">
        <svg class="sr-notification-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="sr-notification-message">
          <p>${message}</p>
        </div>
      </div>
    </div>
  `;
}