<div align="center">

<img src="https://github.com/Bejibun-Framework/bejibun/blob/master/public/images/bejibun.png?raw=true" width="150" alt="Bejibun" />

![GitHub top language](https://img.shields.io/github/languages/top/Bejibun-Framework/bejibun-x402)
![GitHub all releases](https://img.shields.io/github/downloads/Bejibun-Framework/bejibun-x402/total)
![GitHub issues](https://img.shields.io/github/issues/Bejibun-Framework/bejibun-x402)
![GitHub](https://img.shields.io/github/license/Bejibun-Framework/bejibun-x402)
![GitHub release (latest by date including pre-releases)](https://img.shields.io/github/v/release/Bejibun-Framework/bejibun-x402?display_name=tag&include_prereleases)

</div>

# x402 for Bejibun
x402 for Bejibun Framework.

## Usage

### Installation
Install the package.

```bash
# Using Bun
bun add @bejibun/x402

# Using Bejibun
bun ace install @bejibun/x402
```

### Configuration
The configuration file automatically executed if you are using `ace`.

Or

Add `x402.ts` inside config directory on your project if doesn't exist.

```bash
config/x402.ts
```

```ts
const config: Record<string, any> = {
    version: 1,
    network: "base-sepolia",
    address: "0x0000000000000000000000000000000000000000",
    price: "$0.01",
    timeout: 60,
    forceJson: false,
    testnet: true
};

export default config;
```

You can pass the value with environment variables.

### How to Use
How to use tha package.

```ts
import type {TX402Config} from "@bejibun/x402";
import type {FacilitatorConfig, PaywallConfig} from "x402/types";
import X402 from "@bejibun/x402";

/**
 * setConfig(config?: TX402Config)
 * {
 *     customPaywallHtml?: string;
 *     description?: string;
 *     discoverable?: boolean;
 *     mimeType?: string;
 *     inputSchema?: Record<string, any>;
 *     outputSchema?: Record<string, any>;
 * }
 * 
 * setFacilitator(config?: FacilitatorConfig)
 * 
 * setPaywall(config?: PaywallConfig)
 * 
 * setRequest(config: Bun.BunRequest) // Mandatory for request headers
 */
return X402
    .setConfig()
    .setFacilitator()
    .setPaywall()
    .setRequest(request)
    .middleware(() => {
        // your paid resource here
    });
```

## Contributors
- [Havea Crenata](mailto:havea.crenata@gmail.com)

## ☕ Support / Donate

If you find this project helpful and want to support it, you can donate via crypto :

| EVM                                                                                                     | Solana                                                                                                  |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| <img src="https://github.com/Bejibun-Framework/bejibun/blob/master/public/images/EVM.png?raw=true" width="150" /> | <img src="https://github.com/Bejibun-Framework/bejibun/blob/master/public/images/SOL.png?raw=true" width="150" /> |
| 0xdABe8750061410D35cE52EB2a418c8cB004788B3                                                              | GAnoyvy9p3QFyxikWDh9hA3fmSk2uiPLNWyQ579cckMn                                                            |

Or you can buy this `$BJBN (Bejibun)` tokens [here](https://pump.fun/coin/CQhbNnCGKfDaKXt8uE61i5DrBYJV7NPsCDD9vQgypump), beware of bots.
