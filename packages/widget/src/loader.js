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
  var publicKey = scriptUrl.match(/[?&]pk=([^&]+)/);
  
  if (!publicKey || !publicKey[1]) {
    console.error('Shoprocket: No public key (pk) parameter found');
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
  
  // Append version parameter for cache busting
  bundleScript.src = bundleUrl + '?v=__SHOPROCKET_VERSION__';
  bundleScript.setAttribute('data-shoprocket-bundle', 'true');
  bundleScript.setAttribute('data-pk', publicKey[1]); // Pass the public key
  
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
  
  // Insert the script
  var firstScript = document.getElementsByTagName('script')[0];
  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(bundleScript, firstScript);
  } else {
    (document.head || document.body || document.documentElement).appendChild(bundleScript);
  }
})();