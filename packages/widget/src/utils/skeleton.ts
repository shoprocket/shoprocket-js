import { html, TemplateResult } from 'lit';

/**
 * Creates a skeleton element with optional type and modifiers
 * @param type - The skeleton type (e.g., 'title', 'price', 'button')
 * @param modifiers - Additional classes or modifiers (e.g., 'short')
 */
export function skeleton(type?: string, modifiers?: string): TemplateResult {
  const classes = ['sr-skeleton'];
  if (type) classes.push(`sr-skeleton-${type}`);
  if (modifiers) classes.push(modifiers);
  
  return html`<div class="${classes.join(' ')}"></div>`;
}

/**
 * Creates multiple skeleton lines for text content
 * @param count - Number of lines
 * @param lastShort - Whether the last line should be shorter
 */
export function skeletonLines(count: number, lastShort = true): TemplateResult {
  return html`
    ${Array(count).fill(0).map((_, i) => 
      skeleton(undefined, i === count - 1 && lastShort ? 'short' : '')
    )}
  `;
}

/**
 * Creates a skeleton group with a label
 * @param label - The label type
 * @param items - Number of option items
 */
export function skeletonGroup(label: string, items: number): TemplateResult {
  return html`
    <div>
      ${skeleton(label)}
      <div class="sr-skeleton-values">
        ${Array(items).fill(0).map(() => skeleton('option'))}
      </div>
    </div>
  `;
}