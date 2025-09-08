import { html, type TemplateResult } from 'lit';

/**
 * Render error notification UI
 */
export function renderErrorNotification(errorMessage: string | null): TemplateResult {
  if (!errorMessage) {
    return html``;
  }

  return html`
    <div class="sr:fixed sr:top-4 sr:right-4 sr:left-4 sm:sr:left-auto sm:sr:max-w-sm sr:z-[10000] sr:animate-[slideIn_0.3s_ease-out]">
      <div class="sr:bg-red-50 sr:border sr:border-red-200 sr:text-red-800 sr:rounded-sm sr:p-4 sr:shadow-lg sr:flex sr:items-start sr:gap-3">
        <svg class="sr:w-5 sr:h-5 sr:text-red-400 sr:flex-shrink-0 sr:mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="sr:flex-1">
          <p class="sr:text-sm sr:font-medium sr:m-0">${errorMessage}</p>
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
    <div class="sr:fixed sr:top-4 sr:right-4 sr:left-4 sm:sr:left-auto sm:sr:max-w-sm sr:z-[10000] sr:animate-[slideIn_0.3s_ease-out]">
      <div class="sr:bg-green-50 sr:border sr:border-green-200 sr:text-green-800 sr:rounded-sm sr:p-4 sr:shadow-lg sr:flex sr:items-start sr:gap-3">
        <svg class="sr:w-5 sr:h-5 sr:text-green-400 sr:flex-shrink-0 sr:mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="sr:flex-1">
          <p class="sr:text-sm sr:font-medium sr:m-0">${message}</p>
        </div>
      </div>
    </div>
  `;
}