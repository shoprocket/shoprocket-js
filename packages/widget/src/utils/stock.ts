import { defaultVariantOf } from './formatters';

/**
 * Stock and choice facts DERIVED from variants, because the wire serves no product-level
 * rollups: availability lives on each variant as `sellableQuantity` + `inventoryPolicy` (D40),
 * and "does adding need a choice first" follows from the options/variants themselves. The v3
 * product-level fields (`inStock`, `trackInventory`, `quickAddEligible`…) were never served by
 * v3.5 and every read of them silently defaulted - catalog stock-gating gated nothing and
 * JSON-LD marked every product out of stock.
 *
 * Two rules run through everything here:
 * - `inventoryPolicy: 'continue'` means overselling is allowed - stock NEVER gates.
 * - `sellableQuantity: null`/absent means "not resolved on this read" - treat as unlimited,
 *   never as zero. These gates are optimistic UX; checkout's `checkStock` is the enforcer.
 */

/** The stock facts a gate needs off one variant. */
export interface VariantStock {
  sellableQuantity?: number | null;
  inventoryPolicy?: 'deny' | 'continue';
}

/**
 * What may be sold right now, or null when stock does not cap this variant at all: policy
 * `continue`, or a sellable figure the read didn't resolve.
 */
export function variantSellable(variant: VariantStock): number | null {
  if (variant.inventoryPolicy === 'continue') return null;
  return variant.sellableQuantity ?? null;
}

/** May the shopper buy this variant right now? Uncapped counts as yes. */
export function variantPurchasable(variant: VariantStock): boolean {
  const sellable = variantSellable(variant);
  return sellable === null || sellable > 0;
}

/**
 * Is any variant of this product buyable right now? Gift cards are ALWAYS in stock: the server
 * mints value per unit at payment and its inventory engine skips gift_card lines outright, so a
 * client applying physical stock rules to one refuses a sale the platform would take. A product
 * whose variants haven't loaded is treated as in stock - these gates are advisory.
 */
export function productInStock(product: {
  kind?: 'physical' | 'gift_card';
  variants?: VariantStock[];
}): boolean {
  if (product.kind === 'gift_card') return true;
  const variants = product.variants ?? [];
  if (variants.length === 0) return true;
  return variants.some(variantPurchasable);
}

/**
 * Does adding this product to the cart require the shopper to choose something first? True when
 * there is more than one variant or any declared option - the facts the v3 `quickAddEligible` /
 * `hasVariants` / `hasRequiredOptions` flags claimed to summarise.
 */
export function productNeedsChoice(product: {
  options?: unknown[];
  variants?: unknown[];
}): boolean {
  return (product.options?.length ?? 0) > 0 || (product.variants?.length ?? 0) > 1;
}

/**
 * The figure that CAPS buying a given variant of this product, or undefined when stock does not
 * gate it at all (gift card, policy `continue`, or sellable unresolved). Pass the shopper's
 * chosen variant when there is one; defaults to the product's default variant. undefined flows
 * through every consumer as "unlimited".
 */
export function gateQuantityOf(
  product: {
    kind?: 'physical' | 'gift_card';
    variants?: Array<VariantStock & { isDefault?: boolean }>;
  },
  variant?: VariantStock | null,
): number | undefined {
  if (product.kind === 'gift_card') return undefined;
  const v = variant ?? defaultVariantOf(product);
  if (!v) return undefined;
  return variantSellable(v) ?? undefined;
}
