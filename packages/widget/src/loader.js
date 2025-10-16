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
    console.warn('Shoprocket: Multiple shoprocket.js scripts detected. Only one is required - please remove duplicate script tags.');
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
  
  // Detect ES module support
  function supportsModules() {
    var script = document.createElement('script');
    return 'noModule' in script;
  }
  
  // Determine bundle URL based on browser capabilities
  var useModules = supportsModules();
  var bundleUrl = scriptUrl.replace(/shoprocket\.js/, 'main.shoprocket.js');
  
  // Create and inject the appropriate bundle script
  var bundleScript = document.createElement('script');
  
  if (useModules) {
    // Modern browsers: Use ES modules for code splitting
    bundleScript.type = 'module';
    bundleScript.setAttribute('data-bundle-type', 'esm');
  } else {
    // Legacy browsers: Use IIFE bundle (fallback)
    bundleUrl = scriptUrl.replace(/shoprocket\.js/, 'bundle.shoprocket.js');
    bundleScript.async = true;
    bundleScript.setAttribute('data-bundle-type', 'iife');
  }
  
  // For ES modules, use import map to ensure all chunks use same versioned URL
  if (useModules) {
    var versionParam = bundleUrl.indexOf('?') > -1 ? '&v=__SHOPROCKET_VERSION__' : '?v=__SHOPROCKET_VERSION__';
    var versionedUrl = bundleUrl + versionParam;

    // Create import map to alias main.shoprocket.js to versioned URL
    var importMap = document.createElement('script');
    importMap.type = 'importmap';
    importMap.textContent = JSON.stringify({
      imports: {
        './main.shoprocket.js': versionedUrl
      }
    });
    document.head.appendChild(importMap);

    bundleScript.src = versionedUrl;
  } else {
    // IIFE doesn't need import map
    var versionParam = bundleUrl.indexOf('?') > -1 ? '&v=__SHOPROCKET_VERSION__' : '?v=__SHOPROCKET_VERSION__';
    bundleScript.src = bundleUrl + versionParam;
  }

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