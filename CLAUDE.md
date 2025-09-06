# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a JavaScript/TypeScript monorepo for Shoprocket v3, containing three npm workspace packages:

- **packages/core/** - `@shoprocket/core` - Public MIT-licensed SDK for API communication (< 10KB)
- **packages/react/** - `@shoprocket/react` - Public MIT-licensed React hooks and components (< 15KB) 
- **packages/widget/** - `@shoprocket/widget` - Private proprietary embeddable widget (< 50KB, CDN-only)

Built with Vite, TypeScript, and uses npm workspaces for dependency management.

## Essential Commands

### Development
```bash
# Start all packages in dev mode
npm run dev

# Start specific package
npm run dev --workspace=@shoprocket/core
npm run dev --workspace=@shoprocket/react  
npm run dev --workspace=@shoprocket/widget

# Build all packages
npm run build

# Build specific package
npm run build --workspace=@shoprocket/core
```

### Testing & Quality
```bash
# Run tests across all packages
npm run test

# Run tests for specific package  
npm run test --workspace=@shoprocket/core

# Lint all packages
npm run lint

# Check bundle sizes
npm run size
```

### Package Management
```bash
# Clean all build artifacts
npm run clean

# Release workflow (uses Changesets)
npm run version    # Update versions
npm run release    # Build and publish to npm
```

## Architecture Overview

### Core SDK (`@shoprocket/core`)
- **Entry point**: `packages/core/src/index.ts` - Main `ShoprocketCore` class
- **API client**: `packages/core/src/api.ts` - HTTP client with auth and locale support
- **Services**: `packages/core/src/services/` - Modular service classes:
  - `session.ts` - Authentication and session management
  - `products.ts` - Product catalog operations  
  - `cart.ts` - Shopping cart functionality
  - `store.ts` - Store configuration and metadata

### React Package (`@shoprocket/react`)  
- **Context**: `packages/react/src/contexts/ShoprocketContext.tsx` - Provider wrapping Core SDK
- **Hooks**: `packages/react/src/hooks/` - React hooks for each service
- **Components**: `packages/react/src/components/` - Pre-built UI components
- **Dependencies**: Uses `@shoprocket/core` as internal dependency via `file:../core`

### Widget (`@shoprocket/widget`)
- **Framework**: Built with Lit web components and Tailwind CSS v4
- **Entry**: `packages/widget/src/index.ts` - Widget initialization and embed system
- **Styling**: `packages/widget/src/styles.css` - Component styles
- **Build target**: Single bundled file for CDN distribution

## Development Patterns

### Package Dependencies
- React package depends on Core via local file reference
- Widget package depends on Core via local file reference  
- All packages share root-level dev dependencies (TypeScript, Vite, ESLint)

### Bundle Size Limits
Each package has size-limit configuration:
- Core: 10KB limit (both CJS and ESM)
- React: 15KB limit
- Widget: No automated limit (manually monitored)

### Build Configuration
- **Vite**: Used for building all packages with different configs per package
- **TypeScript**: Project references configured in root `tsconfig.json`
- **Output**: Dual CJS/ESM builds with TypeScript declarations

### API Integration
All packages communicate with Shoprocket v3 API:
- Default API URL: `https://api.shoprocket.io/v3`
- Authentication via publishable keys (`pk_...`)
- Session tokens for user state
- Locale support for internationalization

## Testing Strategy

- **Framework**: Vitest for all packages
- **Location**: Tests co-located with source files or in `__tests__` directories
- **Commands**: Package-specific test scripts, runnable from root via workspaces

## Quality Requirements

Before committing changes, ensure:
1. `npm run lint` passes for affected packages
2. `npm run test` passes for affected packages  
3. `npm run build` succeeds for affected packages
4. `npm run size` reports acceptable bundle sizes