import { html, type TemplateResult } from 'lit';
import { t } from '../../utils/i18n';
import type { AccountOrdersContext } from './account-types';

export function renderAccountOrders(ctx: AccountOrdersContext): TemplateResult {
  if (ctx.selectedOrder) {
    return renderOrderDetail(ctx);
  }
  return renderOrderList(ctx);
}

function renderOrderList(ctx: AccountOrdersContext): TemplateResult {
  if (ctx.loading) {
    return html`<div class="sr-account-loading">${t('account.loading_orders', 'Loading orders...')}</div>`;
  }

  if (!ctx.orders.length) {
    return html`
      <div class="sr-account-empty">
        <p>${t('account.no_orders', 'You haven\'t placed any orders yet.')}</p>
      </div>
    `;
  }

  return html`
    <div class="sr-account-orders">
      ${ctx.orders.map(order => html`
        <button class="sr-account-order-card" @click=${() => ctx.onSelectOrder(order.id)}>
          <div class="sr-account-order-card-header">
            <span class="sr-account-order-number">#${order.orderNumber}</span>
            <span class="sr-account-order-date">${formatDate(order.createdAt)}</span>
          </div>
          <div class="sr-account-order-card-body">
            <div class="sr-account-order-statuses">
              <span class="sr-account-status-badge sr-account-status-${getStatusType(order.paymentStatus)}">
                ${formatStatus(order.paymentStatus)}
              </span>
              ${order.fulfillmentStatus && order.fulfillmentStatus !== 'not_required' ? html`
                <span class="sr-account-status-badge sr-account-status-${getStatusType(order.fulfillmentStatus)}">
                  ${formatStatus(order.fulfillmentStatus)}
                </span>
              ` : ''}
            </div>
            <span class="sr-account-order-total">${order.total.formatted}</span>
          </div>
          <div class="sr-account-order-card-footer">
            <span class="sr-account-order-items">${order.itemCount} ${order.itemCount === 1 ? t('account.item', 'item') : t('account.items', 'items')}</span>
          </div>
        </button>
      `)}
      ${ctx.ordersMeta && ctx.ordersMeta.lastPage > 1 ? renderPagination(ctx) : ''}
    </div>
  `;
}

function renderPagination(ctx: AccountOrdersContext): TemplateResult {
  const meta = ctx.ordersMeta!;
  return html`
    <div class="sr-account-pagination">
      <button
        class="sr-account-button-secondary sr-account-button-sm"
        ?disabled=${meta.currentPage <= 1}
        @click=${() => ctx.onPageChange(meta.currentPage - 1)}
      >${t('account.previous', 'Previous')}</button>
      <span class="sr-account-pagination-info">
        ${t('account.page', 'Page')} ${meta.currentPage} ${t('account.of', 'of')} ${meta.lastPage}
      </span>
      <button
        class="sr-account-button-secondary sr-account-button-sm"
        ?disabled=${meta.currentPage >= meta.lastPage}
        @click=${() => ctx.onPageChange(meta.currentPage + 1)}
      >${t('account.next', 'Next')}</button>
    </div>
  `;
}

function renderOrderDetail(ctx: AccountOrdersContext): TemplateResult {
  const order = ctx.selectedOrder!;
  if (ctx.loading) {
    return html`<div class="sr-account-loading">${t('account.loading_order', 'Loading order details...')}</div>`;
  }

  return html`
    <div class="sr-account-order-detail">
      <button class="sr-account-back-button" @click=${ctx.onBackToOrders}>
        <span class="sr-account-back-arrow">&larr;</span> ${t('account.back_to_orders', 'Back to orders')}
      </button>

      <div class="sr-account-order-detail-header">
        <h3 class="sr-account-order-detail-title">${t('account.order', 'Order')} #${order.orderNumber}</h3>
        <span class="sr-account-order-date">${formatDate(order.createdAt)}</span>
      </div>

      <div class="sr-account-order-statuses" style="margin-bottom: var(--spacing-4, 1rem);">
        <span class="sr-account-status-badge sr-account-status-${getStatusType(order.paymentStatus)}">
          ${formatStatus(order.paymentStatus)}
        </span>
        ${order.fulfillmentStatus && order.fulfillmentStatus !== 'not_required' ? html`
          <span class="sr-account-status-badge sr-account-status-${getStatusType(order.fulfillmentStatus)}">
            ${formatStatus(order.fulfillmentStatus)}
          </span>
        ` : ''}
      </div>

      ${order.trackingNumber ? html`
        <div class="sr-account-detail-row">
          <span class="sr-account-detail-label">${t('account.tracking', 'Tracking')}</span>
          <span class="sr-account-detail-value">${order.trackingNumber}</span>
        </div>
      ` : ''}

      <!-- Items -->
      <div class="sr-account-section">
        <h4 class="sr-account-section-title">${t('account.items_title', 'Items')}</h4>
        ${order.items.map(item => html`
          <div class="sr-account-order-item">
            <div class="sr-account-order-item-info">
              <span class="sr-account-order-item-name">${item.productName}</span>
              ${item.variantName ? html`<span class="sr-account-order-item-variant">${item.variantName}</span>` : ''}
              <span class="sr-account-order-item-qty">${t('account.qty', 'Qty')}: ${item.quantity}</span>
            </div>
            <span class="sr-account-order-item-price">${item.subtotal.formatted}</span>
          </div>
        `)}
      </div>

      <!-- Totals -->
      <div class="sr-account-section">
        <div class="sr-account-totals">
          <div class="sr-account-detail-row">
            <span class="sr-account-detail-label">${t('account.subtotal', 'Subtotal')}</span>
            <span class="sr-account-detail-value">${order.totals.subtotal.formatted}</span>
          </div>
          ${order.totals.shipping.amount > 0 ? html`
            <div class="sr-account-detail-row">
              <span class="sr-account-detail-label">${t('account.shipping', 'Shipping')}</span>
              <span class="sr-account-detail-value">${order.totals.shipping.formatted}</span>
            </div>
          ` : ''}
          ${order.totals.tax.amount > 0 ? html`
            <div class="sr-account-detail-row">
              <span class="sr-account-detail-label">${t('account.tax', 'Tax')}</span>
              <span class="sr-account-detail-value">${order.totals.tax.formatted}</span>
            </div>
          ` : ''}
          ${order.totals.discount.amount > 0 ? html`
            <div class="sr-account-detail-row">
              <span class="sr-account-detail-label">${t('account.discount', 'Discount')}</span>
              <span class="sr-account-detail-value">-${order.totals.discount.formatted}</span>
            </div>
          ` : ''}
          <div class="sr-account-detail-row sr-account-total-row">
            <span class="sr-account-detail-label">${t('account.total', 'Total')}</span>
            <span class="sr-account-detail-value">${order.totals.total.formatted}</span>
          </div>
        </div>
      </div>

      <!-- Addresses -->
      ${order.shippingAddress ? html`
        <div class="sr-account-section">
          <h4 class="sr-account-section-title">${t('account.shipping_address', 'Shipping Address')}</h4>
          <div class="sr-account-address">
            <p>${order.shippingAddress.line1}</p>
            ${order.shippingAddress.line2 ? html`<p>${order.shippingAddress.line2}</p>` : ''}
            <p>${order.shippingAddress.city}${order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ''} ${order.shippingAddress.postalCode}</p>
            <p>${order.shippingAddress.country}</p>
          </div>
        </div>
      ` : ''}
      ${order.billingAddress ? html`
        <div class="sr-account-section">
          <h4 class="sr-account-section-title">${t('account.billing_address', 'Billing Address')}</h4>
          <div class="sr-account-address">
            <p>${order.billingAddress.line1}</p>
            ${order.billingAddress.line2 ? html`<p>${order.billingAddress.line2}</p>` : ''}
            <p>${order.billingAddress.city}${order.billingAddress.state ? `, ${order.billingAddress.state}` : ''} ${order.billingAddress.postalCode}</p>
            <p>${order.billingAddress.country}</p>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getStatusType(status: string): string {
  if (['paid', 'fulfilled', 'delivered', 'shipped'].includes(status)) return 'success';
  if (['refunded', 'partially_refunded', 'returned', 'failed', 'failed_delivery', 'canceled'].includes(status)) return 'danger';
  if (['processing', 'partially_fulfilled', 'disputed'].includes(status)) return 'warning';
  return 'neutral';
}
