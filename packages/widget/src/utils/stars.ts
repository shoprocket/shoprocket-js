import { html, type TemplateResult } from 'lit';

/**
 * Render a star rating display
 * @param rating - Rating value (0-5)
 * @param reviewCount - Optional review count to display
 * @param compact - Use compact display (for product cards)
 */
export function renderStarRating(rating: number, reviewCount?: number, compact: boolean = false): TemplateResult {
  const fullStars = Math.floor(rating);
  const partialFill = Math.round((rating - fullStars) * 100);
  const emptyStars = 5 - fullStars - (partialFill > 0 ? 1 : 0);

  return html`
    <div class="sr-stars ${compact ? 'sr-stars-compact' : ''}">
      <div class="sr-stars-icons" aria-label="${rating} out of 5 stars">
        ${Array.from({ length: fullStars }, () => html`
          <svg class="sr-star sr-star-filled" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        `)}
        ${partialFill > 0 ? html`
          <svg class="sr-star sr-star-partial" viewBox="0 0 20 20" style="--sr-star-fill: ${partialFill}%">
            <defs>
              <linearGradient id="star-partial-${Math.round(rating * 10)}">
                <stop offset="${partialFill}%" stop-color="var(--sr-star-color, #f59e0b)"/>
                <stop offset="${partialFill}%" stop-color="var(--sr-star-empty, #d1d5db)"/>
              </linearGradient>
            </defs>
            <path fill="url(#star-partial-${Math.round(rating * 10)})" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        ` : ''}
        ${Array.from({ length: emptyStars }, () => html`
          <svg class="sr-star sr-star-empty" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        `)}
      </div>
      ${reviewCount !== undefined ? html`
        <span class="sr-stars-count">(${reviewCount})</span>
      ` : ''}
    </div>
  `;
}
