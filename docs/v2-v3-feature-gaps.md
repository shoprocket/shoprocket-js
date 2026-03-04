# V2 → V3 Widget Feature Gap Analysis

> Generated 2026-02-16 by comparing `/www/shoprocket.js` (v2) with `/www/shoprocket/shoprocket-js` (v3).

## Status Key

- [ ] Not started
- [x] Complete

---

## Phase 1 — Revenue Impact

- [ ] **Coupon/Discount Code Input UI**
  V2 has a coupon code text field with apply/remove buttons. V3 only shows the discount amount in cart totals — there is no way for customers to enter a promo code.

- [ ] **Shipping Method Selection UI**
  V2 displays available shipping options with pricing and lets the customer choose. V3 calculates shipping server-side but has no visible selection UI when multiple methods exist.

- [ ] **Minimum Order Value Enforcement**
  V2 enforces store-defined minimum order values and blocks checkout below the threshold. V3 has no minimum-order check.

- [ ] **Free Order Handling**
  V2 bypasses the payment gateway for zero-value orders (e.g. 100 % discount). V3 always redirects to a payment provider, which will fail on $0.

- [ ] **Terms & Conditions Checkbox**
  V2 has a configurable required T&C acceptance checkbox before checkout. V3 has nothing.

---

## Phase 2 — B2B & International

- [ ] **Tax ID / VAT Number Field + Validation**
  V2 collects an optional Tax ID/VAT number and validates it via API for B2B exemptions. V3 has no such field.

- [ ] **Currency Selector**
  V2 has a dropdown to switch currencies with auto-detection from URL params or country headers. V3 uses a single currency from the store config with no user-facing switcher.

- [ ] **Language Selector**
  V2 has a dropdown to switch language with auto-detection. V3 loads translations for the detected locale but has no UI for the user to change it.

- [ ] **RTL Language Support**
  V2 supports Arabic and Hebrew with proper RTL layout direction. V3 has no RTL handling.

- [ ] **Order Notes / Special Requests**
  V2 has a notes textarea with 5-second auto-save. V3 has no order notes field.

---

## Phase 3 — Conversion Optimization

- [ ] **Product Ribbons / Badges**
  V2 shows sale percentage, "New", "Free Shipping", "Digital Download", and "PWYW" badges on product cards. V3 has no badge system.

- [ ] **Related Products**
  V2 displays a related-products section on the product detail view. V3 does not.

- [ ] **Newsletter Opt-in Checkbox**
  V2 has an optional newsletter subscription checkbox at checkout. V3 does not.

- [ ] **Affiliate / Referral Tracking**
  V2 reads `affiliate_id` from URL params, stores it for 30 days, and sends it with orders. V3 does not.

- [ ] **Auto-Discount Banners**
  V2 automatically applies qualifying discounts and shows a banner with the qualifying products. V3 does not.

- [ ] **Abandoned Cart Recovery via URL**
  V2 can restore a specific abandoned cart via URL parameters. V3 persists the cart via cookie but has no URL-based recovery mechanism.

---

## Phase 4 — Digital & Special Products

- [ ] **Pay What You Want (PWYW)**
  V2 supports variable-price products where the customer enters their own amount. V3 does not.

- [ ] **Digital Files List**
  V2 displays downloadable files (name, type, icon) included with a digital product on the product detail page. V3 has a product-type field but no file-list UI.

- [ ] **License Key Delivery**
  V2 supports displaying license keys post-purchase. V3 does not.

- [ ] **File Upload Custom Options**
  V2 allows customers to upload files as custom product options (e.g. artwork for printing). V3 does not.

- [ ] **Custom Product Tabs**
  V2 renders additional information tabs on the product detail view (e.g. "Sizing Guide", "Ingredients"). V3 does not.

---

## Phase 5 — Polish & UX

- [ ] **Undo Item Removal**
  V2 shows a quick-undo toast when a cart item is removed. V3 removes immediately with no undo.

- [ ] **Maintenance Mode**
  V2 shows a "store paused" notice when the store is in maintenance mode. V3 does not handle this state.

- [ ] **Product Modal Prev/Next Navigation**
  V2 has previous/next arrows (and keyboard arrow keys) to browse between products in the modal. V3 does not.

- [ ] **Cross-Tab Cart Sync**
  V2 syncs cart state across browser tabs via storage events. V3 does not.

- [ ] **Per-Page Product Count Selector**
  V2 has a dropdown (12/24/48/96) to change products per page. V3 has pagination but no per-page selector.

- [ ] **Store Logo Display**
  V2 shows the store logo in modals and the cart footer. V3 does not.

- [ ] **Full-Screen Image Lightbox**
  V2 uses SimpleLightbox for a full-screen image gallery. V3 has zoom-on-hover but no full-screen lightbox.

- [ ] **OG Meta Tags for Social Sharing**
  V2 injects dynamic OpenGraph meta tags (title, description, image, URL). V3 has Schema.org JSON-LD but no OG tags.

- [ ] **Sentry Error Tracking**
  V2 has Sentry integration for production error monitoring. V3 does not.

- [ ] **API Request Retry Logic**
  V2 uses axios-retry with 3 automatic retries on failed requests. V3 has no retry mechanism.

- [ ] **Dynamic Form Field Visibility**
  V2 shows/hides checkout fields (contact number, company name, tax ID) based on store-level settings. V3 always shows the same fields.

- [ ] **Custom CSS/JS from Embed Config**
  V2 supports injecting per-embed custom CSS and JavaScript from the dashboard config. V3 supports theme CSS vars but not arbitrary custom JS.

- [ ] **Incognito Mode Detection**
  V2 detects when localStorage is unavailable (incognito/private browsing) and shows a warning. V3 does not.

- [ ] **PayPal Client-Side Flow**
  V2 has a deep client-side PayPal integration with approval/capture. V3 delegates all payment to backend redirects. (May be intentional — evaluate if needed.)

- [ ] **Bitcoin Payment Confirmation UI**
  V2 has a special confirmation checkbox for Bitcoin payments. V3 does not. (Evaluate if still needed.)

- [ ] **Product Sort Dropdown**
  V2 has a visible sort-by dropdown (date, price, rating). V3 has the API capability but the UI control may not be fully wired up — verify.

---

## Already Ported (No Action Needed)

These features exist in both v2 and v3:

- Shopping cart (add / remove / update / clear / persist)
- Multi-step checkout wizard
- Product catalog with grid layout
- Product variants & options with cascading selectors
- Bundle / kit products
- Product search
- Category filtering & drill-down
- Customer authentication (password, magic link, OTP)
- Customer account portal (profile, orders, password)
- Product reviews & ratings
- Social sharing buttons
- SEO Schema.org JSON-LD
- Analytics (GA4, Facebook Pixel, Google Ads)
- UTM parameter tracking
- Full i18n translation system (28+ languages)
- CSS variable theming
- Shadow DOM isolation
- Responsive design (mobile-first)
- Buy button embeds
- Multiple embed modes (cart, catalog, product-view, buy-button, categories, account)
- Address validation with country/state cascading
- Billing / shipping address forms
- Payment method selection
- Test mode support
- Cart token / cookie persistence
- SPA navigation tracking
- GDPR personal-data expiry
