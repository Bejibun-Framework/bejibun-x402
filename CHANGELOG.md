# Changelog
All notable changes to this project will be documented in this file.

---

## [v0.2.0](https://github.com/Bejibun-Framework/bejibun-x402/compare/v0.1.0...v0.2.0) - 2026-07-03

### 🩹 Fixes
- Initial release with EVM-only support and single-network routing.

### 📖 Changes
What's New:
- **Multi-network (EVM + SVM) support**: Routes now accept payment from both EVM (Base, etc.) and Solana networks simultaneously, matching `@x402/express` behaviour.
- `TNetworkPayment` type -- per-network entry with optional `scheme`, `price`, `network`, `payTo`, `description`, and `mimeType` overrides.
- `TRoutePayment` type -- replaces the old `TX402Config`; supports an `accepts` array for full multi-network control.
- `TScheme` type -- `"exact"` | `"upto"` | `"batch-settlement"`.
- `accepts` array field on `TRoutePayment` -- pass an explicit list of network entries for full control.
- `config.networks` array -- replaces the single `network` + `address` pair; supports both EVM and SVM entries project-wide.
- **`BunAdapter`** -- new class implementing `@x402/core HTTPAdapter` directly against `Bun.BunRequest`, handling headers, method, path, URL, query params, user-agent, and accept header.
- Scheme registration is now driven by the resolved `accepts` list; every unique network is registered exactly once (EVM registers `exact`, `upto`, and `batch-settlement`; SVM registers `exact`).
- `X402Builder` now maintains a **static server cache** (`_serverCache` + `_initPromises`) so each route's `x402HTTPResourceServer` is initialized only once across all requests, preventing duplicate SVM feePayer lookups.
- Payment flow delegates entirely to `@x402/core`'s `x402HTTPResourceServer.processHTTPRequest` and `processSettlement`, replacing the hand-rolled verify/settle/decode chain.
- CORS headers (`Access-Control-Allow-Origin: *`, `Access-Control-Expose-Headers: *`) are now attached to all 402 and settlement responses.
- Handler cancellation: if the route handler throws or returns a 4xx/5xx, `cancellationDispatcher.cancel()` is called before returning.
- Facilitator errors during settlement are caught and returned as `502` JSON responses instead of being re-thrown.
- `X402Exception` now defaults to error code `502` instead of `402`.

Changes:
- `config/x402.ts` no longer has a `version` field at all (the old `x402Version`/`version: 1` key is gone project-wide); it now ships with a flat `networks` array containing Base mainnet (`eip155:8453`) and Solana mainnet (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`) entries instead of a single `network` + `address` + `testnet` block.
- Default scheme is `"exact"`.
- `X402Builder` resolves networks via a **4-level priority cascade**: explicit `accepts` array -> route single-network shorthand (`network` + `payTo`) -> config `networks` block -> built-in defaults (Base + Polygon + Arbitrum + World Chain for EVM; Solana mainnet for SVM).
- `setPaywall()` removed; replaced by `setRoutePayment(config?: TRoutePayment)`.
- `setConfig()` removed; per-route metadata (`description`, `mimeType`, `scheme`, `price`) are now fields on `TRoutePayment`.
- `setFacilitator()` now accepts `TFacilitator` (a plain `{ url?: string, createAuthHeaders?: () => Promise<...> }` object) instead of the old `FacilitatorConfig`; defaults to `@coinbase/x402` facilitator.
- `middleware()` return type tightened to `Promise<Response>`.
- Dependency `x402` replaced by `@coinbase/x402 ^2.1.0`, `@x402/core ^2.17.0`, `@x402/evm ^2.17.0`, and `@x402/svm ^2.17.0`.
- `src/types/` directory added; types are now exported from their own module instead of being inlined in builder files.
- Build script now includes a `types` step (`cp -rf src/types dist`) so type definitions are copied alongside compiled output.

### ❤️Contributors
- Havea Crenata ([@crenata](https://github.com/crenata))

**Full Changelog**: https://github.com/Bejibun-Framework/bejibun-x402/blob/master/CHANGELOG.md

---

## [v0.1.0](https://github.com/Bejibun-Framework/bejibun-x402/compare/v0.1.0...v0.1.0) - 2025-11-14

### 🩹 Fixes

### 📖 Changes
What's New:
- Adding x402 builder
- Adding x402 config
- Adding x402 exception
- Adding x402 facade

### ❤️Contributors
- Havea Crenata ([@crenata](https://github.com/crenata))

**Full Changelog**: https://github.com/Bejibun-Framework/bejibun-x402/blob/master/CHANGELOG.md