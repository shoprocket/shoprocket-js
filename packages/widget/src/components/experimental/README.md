# Experimental Components

This folder contains components that were developed but ultimately not used in production. They are preserved here for potential future use or reference.

## Components

### searchable-select.ts

A custom searchable dropdown component originally developed for the address form in checkout. It was removed in favor of native HTML select elements after realizing that all major e-commerce platforms (Shopify, Stripe, WooCommerce, etc.) use native selects for good reasons:

- **Better mobile UX**: Native selects use platform-specific UI (iOS wheel picker, Android dropdown)
- **Accessibility**: Native selects work perfectly with screen readers out of the box
- **Higher conversion**: Less friction in checkout = better conversion rates
- **Browser autofill**: Better integration with password managers and autofill
- **Reliability**: No JavaScript required = one less thing that can break

The implementation includes some interesting patterns that might be useful elsewhere:
- Teleport pattern for rendering dropdowns outside of overflow containers
- Keyboard navigation with proper focus management
- CSS-only hover states (no JS event listeners)
- Client-side search filtering
- Prevention of password manager UI interference

Consider using this component only in non-critical paths where enhanced search functionality provides clear user value (e.g., product filters, admin interfaces).

## Usage

These components are not included in the main build. To use them:

1. Import the component and its styles
2. Ensure the styles are included in your build
3. Test thoroughly on mobile devices
4. Consider accessibility implications