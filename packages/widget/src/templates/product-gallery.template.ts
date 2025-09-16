import { html, type TemplateResult } from 'lit';
import type { Media } from '../types/api';

export interface GalleryHandlers {
  getMediaUrl: (media: any, transformations?: string) => string;
  handleImageError: (e: Event) => void;
  handleImageLoad?: (url: string) => void;
  handleMouseEnterZoom?: () => void;
  handleMouseLeaveZoom?: () => void;
  handleMouseMoveZoom?: (e: MouseEvent) => void;
  selectMediaIndex?: (index: number) => void;
}

export interface GalleryState {
  selectedMediaIndex: number;
  zoomActive?: boolean;
  zoomPosition?: { x: number; y: number };
  loadedImages?: Set<string>;
}

/**
 * Renders product image gallery with thumbnails and zoom
 */
export const renderProductGallery = (
  media: Media[] | undefined,
  productName: string,
  state: GalleryState,
  handlers: GalleryHandlers
): TemplateResult => {
  if (!media || media.length === 0) {
    return html`
      <div class="sr-media-container sr-media-placeholder sr-product-detail-image-main"></div>
    `;
  }
  
  const currentMedia = media[state.selectedMediaIndex] || media[0];
  
  return html`
    <div class="sr-product-gallery">
      <!-- Main image with zoom -->
      ${renderMainImage(currentMedia, productName, state, handlers)}
      
      <!-- Thumbnails -->
      ${media.length > 1 ? renderThumbnails(media, productName, state, handlers) : ''}
    </div>
  `;
};

const renderMainImage = (
  media: Media,
  productName: string,
  state: GalleryState,
  handlers: GalleryHandlers
): TemplateResult => {
  const url = handlers.getMediaUrl(media, 'w=800,h=800,fit=cover');
  const isLoaded = state.loadedImages?.has(url) ?? true;
  
  return html`
    <div 
      class="sr-media-container sr-product-detail-image-main" 
      data-loaded="${isLoaded}"
      data-zoom-active="${state.zoomActive || false}"
      @mouseenter="${handlers.handleMouseEnterZoom}"
      @mouseleave="${handlers.handleMouseLeaveZoom}"
      @mousemove="${handlers.handleMouseMoveZoom}"
    >
      ${!isLoaded ? html`<div class="sr-media-skeleton"></div>` : ''}
      <img 
        src="${url}"
        alt="${productName}"
        class="sr-media-image"
        loading="eager"
        @load="${handlers.handleImageLoad ? () => handlers.handleImageLoad!(url) : null}"
        @error="${handlers.handleImageError}"
      >
      
      ${state.zoomActive ? renderZoom(media, productName, state, handlers) : ''}
    </div>
  `;
};

const renderZoom = (
  media: Media,
  productName: string,
  state: GalleryState,
  handlers: GalleryHandlers
): TemplateResult => {
  return html`
    <div class="sr-product-detail-image-zoom"
         style="--zoom-x: ${state.zoomPosition?.x || 0}%; --zoom-y: ${state.zoomPosition?.y || 0}%;">
      <img 
        src="${handlers.getMediaUrl(media, 'w=1600,h=1600,fit=cover')}"
        alt="${productName} (zoomed)"
        class="sr-media-image"
        loading="lazy"
      >
    </div>
    
    <!-- Zoom lens indicator -->
    <div class="sr-zoom-lens"
         style="--lens-x: ${state.zoomPosition?.x || 0}%; --lens-y: ${state.zoomPosition?.y || 0}%;">
    </div>
  `;
};

const renderThumbnails = (
  media: Media[],
  productName: string,
  state: GalleryState,
  handlers: GalleryHandlers
): TemplateResult => {
  return html`
    <div class="sr-product-thumbnails">
      ${media.map((m, index) => {
        const url = handlers.getMediaUrl(m, 'w=150,h=150,fit=cover');
        const isLoaded = state.loadedImages?.has(url) ?? true;
        
        return html`
          <button
            class="sr-product-thumbnail ${index === state.selectedMediaIndex ? 'active' : ''}"
            @click="${() => handlers.selectMediaIndex?.(index)}"
            aria-label="View image ${index + 1} of ${media.length}"
          >
            <div class="sr-media-container sr-product-thumbnail-image" data-loaded="${isLoaded}">
              ${!isLoaded ? html`<div class="sr-media-skeleton"></div>` : ''}
              <img 
                src="${url}"
                alt="${productName} thumbnail ${index + 1}"
                class="sr-media-image"
                loading="lazy"
                @load="${handlers.handleImageLoad ? () => handlers.handleImageLoad!(url) : null}"
                @error="${handlers.handleImageError}"
              >
            </div>
          </button>
        `;
      })}
    </div>
  `;
};