# Changelog
All notable changes to this project will be documented in this file.

---

## [v0.2.0](https://github.com/Bejibun-Framework/bejibun-x402/compare/v0.1.0...v0.2.0) - 2026-06-25

### 🩹 Fixes
- Initial release with EVM-only support.

### 📖 Changes
What's New:
- **Multi-network (EVM + SVM) support**: Routes now accept payment from both EVM (Base, etc.) and Solana networks simultaneously, matching `@x402/express` behaviour.
- `TNetworkPaymentConfig` type — per-network entry with optional `scheme`, `price`, `description`, and `mimeType` overrides.
- `accepts` array field on `TRoutePaymentConfig` — pass an explicit list of network entries for full control.
- `config.networks.evm` / `config.networks.svm` config blocks for project-wide defaults across both chains.
- Scheme registration is now driven by the resolved `accepts` list; every unique network is registered exactly once.
  
Changes:
- `config/x402.ts` default config now ships with both `networks.evm` (Base mainnet) and `networks.svm` (Solana mainnet) entries instead of a single `network` + `payTo`.
- `X402Builder` resolves networks via a 5-level priority cascade: explicit `accepts` array → route single-network shorthand → config `networks` block → legacy config `network`/`payTo` → built-in defaults.
- `buildHttpServer` iterates the full `accepts` list to register all required schemes instead of branching on a single network string.


### Backward Compatible
- Single-network `network` + `payTo` on `TRoutePaymentConfig` still works (treated as a single-entry accepts list).
- Legacy `config.network` + `config.payTo` in project config files still work (priority 4 fallback).

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