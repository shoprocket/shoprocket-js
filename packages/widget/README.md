# Shoprocket Widget

Drop-in eCommerce widget for Shoprocket platform. This is the official widget that merchants can embed on their websites with just a few lines of code.

## License

This package is proprietary software. The source code is available for inspection and debugging purposes only.

Copyright © 2025 Shoprocket Ltd. All rights reserved.

## Usage (For Merchants)

*Usage documentation coming soon...*

## Development

This package is part of the Shoprocket monorepo and is built using the `@shoprocket/core` SDK.

### Building

```bash
npm run build
```

This creates `dist/shoprocket.js` ready for CDN deployment.

### Size Target

- Maximum bundle size: **50KB** (including styles)
- Current size: Check with `npm run size`

## For Shoprocket Team

### Deployment

The built widget should be deployed to:
- Production: `https://cdn.shoprocket.io/v3/widget.js`
- Staging: `https://cdn-staging.shoprocket.io/v3/widget.js`

### Version Strategy

Widget versions are locked to the API version for compatibility:
- v3 widget works with v3 API
- Breaking changes require new major version