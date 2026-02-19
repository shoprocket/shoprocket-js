import { css, unsafeCSS } from 'lit';

// Import the compiled widget CSS as a string
// @ts-ignore
import widgetStyles from '../styles.css?inline';

/**
 * Shared styles for all Shoprocket components
 * This includes all Tailwind CSS utilities and the widget design system
 */
export const sharedStyles = css`${unsafeCSS(widgetStyles)}`;

/**
 * Create a constructable stylesheet that can be shared across all shadow roots
 * This is more efficient than duplicating styles in each component
 */
export const sharedStylesheet = new CSSStyleSheet();

// Only populate the stylesheet if we're in a browser environment
if (typeof window !== 'undefined' && 'adoptedStyleSheets' in document) {
  sharedStylesheet.replaceSync(widgetStyles);
}