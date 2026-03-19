/**
 * Shoprocket Widget Loader v3
 * Copyright (c) 2025 Shoprocket Ltd.
 * 
 * This lightweight loader prevents duplicate script loading and manages
 * the main widget bundle. Users embed this script on their sites.
 */
(function() {
  'use strict';
  
  // Prevent multiple executions
  if (window.Shoprocket || window.__ShoprocketInit) {
    console.warn('Shoprocket: Multiple loader.js scripts detected. Only one is required - please remove duplicate script tags.');
    return;
  }
  
  // Mark as initializing
  window.__ShoprocketInit = true;
  
  // Get current script element and extract parameters
  var currentScript = document.currentScript;
  if (!currentScript || !currentScript.src) {
    console.error('Shoprocket: Unable to determine script source');
    return;
  }

  var scriptUrl = currentScript.src;
  var publicKey = currentScript.getAttribute('data-pk');

  // V2 Bridge: Auto-detect legacy V2 embed format
  if (!publicKey) {
    var v2Element = document.querySelector('.sr-element[data-embed]');
    if (v2Element) {
      var v2ConfigScript = v2Element.querySelector('script[type="application/json"]');
      if (v2ConfigScript) {
        try {
          var v2Config = JSON.parse(v2ConfigScript.textContent);
          publicKey = v2Config.publishable_key;

          // TODO: Full V2 bridge - map v2Config.options/styles to V3 data attributes
          // V2 to V3 embed type mapping
          var embedType = v2Element.getAttribute('data-embed');
          var v2ToV3Map = {
            'buy-button': 'buy-button',
            'product': 'product-view',
            'basket': 'cart'
          };

          console.info('Shoprocket: V2 embed format detected - using legacy config');
        } catch (e) {
          console.error('Shoprocket: Failed to parse V2 config', e);
        }
      }
    }
  }

  if (!publicKey) {
    console.error('Shoprocket: No public key found. Add data-pk attribute to script tag.');
    delete window.__ShoprocketInit;
    return;
  }

  // Add preconnect hints IMMEDIATELY for faster API requests (~300ms LCP savings)
  // This runs before bundle loads, catching the first API request
  (function() {
    try {
      var apiOrigin = new URL(__SHOPROCKET_API_URL__).origin;

      // Check if preconnect already exists
      if (!document.querySelector('link[rel="preconnect"][href="' + apiOrigin + '"]')) {
        // Add dns-prefetch fallback for older browsers
        var dnsPrefetch = document.createElement('link');
        dnsPrefetch.rel = 'dns-prefetch';
        dnsPrefetch.href = apiOrigin;
        document.head.appendChild(dnsPrefetch);

        // Add preconnect for modern browsers
        var preconnect = document.createElement('link');
        preconnect.rel = 'preconnect';
        preconnect.href = apiOrigin;
        preconnect.crossOrigin = 'anonymous';
        document.head.appendChild(preconnect);
      }
    } catch (e) {
      // Invalid URL, ignore - don't block loader
    }
  })();

  var bundleUrl = scriptUrl.replace(/loader\.js/, 'main.shoprocket.js');

  // Create import map to ensure all chunks use same versioned URL
  var versionParam = bundleUrl.indexOf('?') > -1 ? '&v=__SHOPROCKET_VERSION__' : '?v=__SHOPROCKET_VERSION__';
  var versionedUrl = bundleUrl + versionParam;

  // Must alias ALL possible import paths that chunks might use
  var baseUrl = bundleUrl.replace(/\?.*$/, ''); // Remove query params
  var imports = {
    './main.shoprocket.js': versionedUrl,        // Relative import from same dir
    '/main.shoprocket.js': versionedUrl,         // Absolute path import
    'main.shoprocket.js': versionedUrl           // Bare specifier
  };
  imports[baseUrl] = versionedUrl;               // Full URL without version

  var importMap = document.createElement('script');
  importMap.type = 'importmap';
  importMap.textContent = JSON.stringify({ imports: imports });
  document.head.appendChild(importMap);

  // Create and inject the ESM bundle script
  var bundleScript = document.createElement('script');
  bundleScript.type = 'module';
  bundleScript.setAttribute('data-bundle-type', 'esm');
  bundleScript.src = versionedUrl;

  bundleScript.setAttribute('data-shoprocket-bundle', 'true');
  bundleScript.setAttribute('data-pk', publicKey); // Pass the public key
  
  // Handle load success
  bundleScript.onload = function() {
    delete window.__ShoprocketInit;
    // The bundle will initialize itself
  };
  
  // Handle load failure
  bundleScript.onerror = function() {
    delete window.__ShoprocketInit;
    console.error('Shoprocket: Failed to load widget bundle from', bundleUrl);
  };

  // Reserve space for widgets to prevent Cumulative Layout Shift (CLS)
  // This runs immediately before bundle loads, reserving approximate heights
  var MIN_HEIGHTS = {
    'product-view': '650px',
    'catalog': '800px',
    'categories': '400px',
    'buy-button': '50px'
    // cart is omitted (fixed/floating position, doesn't affect CLS)
  };

  var widgets = document.querySelectorAll('[data-shoprocket]');
  for (var i = 0; i < widgets.length; i++) {
    var widget = widgets[i];
    var widgetType = widget.getAttribute('data-shoprocket');
    var minHeight = MIN_HEIGHTS[widgetType];

    if (minHeight) {
      widget.style.minHeight = minHeight;
      widget.setAttribute('data-sr-reserve', 'true');
    }
  }

  // Insert the script
  var firstScript = document.getElementsByTagName('script')[0];
  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(bundleScript, firstScript);
  } else {
    (document.head || document.body || document.documentElement).appendChild(bundleScript);
  }
})();