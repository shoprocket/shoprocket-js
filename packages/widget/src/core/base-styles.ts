import { css } from 'lit';

/**
 * Base styles that reset the rem base to 16px
 * This prevents parent page font-size from affecting our rem calculations
 */
export const baseStyles = css`
  :host {
    /* Set base font-size to 16px on the shadow root host */
    /* This won't affect rem calculations (they still use document root) */
    /* But it ensures our component has a consistent base */
    font-size: 16px;
    
    /* Block-level display by default */
    display: block;
    
    /* Base font settings */
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: normal;
    color: inherit;
  }
`;