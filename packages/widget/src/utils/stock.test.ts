import { describe, it, expect } from 'vitest';
import { variantSellable, variantPurchasable, productInStock, productNeedsChoice, gateQuantityOf } from './stock';

describe('variantSellable / variantPurchasable', () => {
  it('caps on the served sellable figure under policy deny', () => {
    expect(variantSellable({ sellableQuantity: 5, inventoryPolicy: 'deny' })).toBe(5);
    expect(variantPurchasable({ sellableQuantity: 5, inventoryPolicy: 'deny' })).toBe(true);
  });

  it('zero sellable under deny is not purchasable', () => {
    expect(variantPurchasable({ sellableQuantity: 0, inventoryPolicy: 'deny' })).toBe(false);
  });

  it('policy continue never caps, whatever the count says', () => {
    expect(variantSellable({ sellableQuantity: 0, inventoryPolicy: 'continue' })).toBeNull();
    expect(variantPurchasable({ sellableQuantity: 0, inventoryPolicy: 'continue' })).toBe(true);
  });

  it('unresolved sellable (null or absent) means unlimited, never zero', () => {
    expect(variantSellable({ sellableQuantity: null, inventoryPolicy: 'deny' })).toBeNull();
    expect(variantPurchasable({ sellableQuantity: null, inventoryPolicy: 'deny' })).toBe(true);
    expect(variantPurchasable({})).toBe(true);
  });
});

describe('productInStock', () => {
  it('is in stock while any variant is purchasable', () => {
    expect(productInStock({ variants: [
      { sellableQuantity: 0, inventoryPolicy: 'deny' },
      { sellableQuantity: 3, inventoryPolicy: 'deny' },
    ] })).toBe(true);
  });

  it('is out of stock only when every variant is exhausted under deny', () => {
    expect(productInStock({ variants: [
      { sellableQuantity: 0, inventoryPolicy: 'deny' },
      { sellableQuantity: 0, inventoryPolicy: 'deny' },
    ] })).toBe(false);
  });

  it('gift cards are always in stock - the server mints per unit and skips them in inventory', () => {
    expect(productInStock({ kind: 'gift_card', variants: [{ sellableQuantity: 0, inventoryPolicy: 'deny' }] })).toBe(true);
  });

  it('unloaded variants read as in stock - these gates are advisory', () => {
    expect(productInStock({})).toBe(true);
    expect(productInStock({ variants: [] })).toBe(true);
  });
});

describe('productNeedsChoice', () => {
  it('needs a choice with options or several variants, not with one plain variant', () => {
    expect(productNeedsChoice({ options: [{}], variants: [{}] })).toBe(true);
    expect(productNeedsChoice({ variants: [{}, {}] })).toBe(true);
    expect(productNeedsChoice({ variants: [{}] })).toBe(false);
    expect(productNeedsChoice({})).toBe(false);
  });
});

describe('gateQuantityOf', () => {
  const deny5 = { sellableQuantity: 5, inventoryPolicy: 'deny' as const };

  it('caps at the chosen variant sellable', () => {
    expect(gateQuantityOf({ variants: [deny5] }, deny5)).toBe(5);
  });

  it('falls back to the default variant when none is chosen', () => {
    const other = { sellableQuantity: 9, inventoryPolicy: 'deny' as const, isDefault: true };
    expect(gateQuantityOf({ variants: [deny5, other] })).toBe(9);
  });

  it('never gates gift cards, continue-policy variants, or unresolved reads', () => {
    expect(gateQuantityOf({ kind: 'gift_card', variants: [deny5] }, deny5)).toBeUndefined();
    expect(gateQuantityOf({ variants: [] }, { sellableQuantity: 4, inventoryPolicy: 'continue' })).toBeUndefined();
    expect(gateQuantityOf({ variants: [] }, { sellableQuantity: null, inventoryPolicy: 'deny' })).toBeUndefined();
  });
});
