<div align="center">

<img src="https://github.com/Bejibun-Framework/bejibun/blob/master/public/images/bejibun.png?raw=true" width="150" alt="Bejibun" />

![GitHub top language](https://img.shields.io/github/languages/top/Bejibun-Framework/bejibun-x402)
![NPM Downloads](https://img.shields.io/npm/d18m/%40bejibun%2Fx402)
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

```ts config/x402.ts
const config: Record<string, any> = {
    version: 2,
    network: "eip155:84532",
    address: "0xdABe8750061410D35cE52EB2a418c8cB004788B3",
    price: "$0.01",
    scheme: "exact",
    timeout: 60,
    forceJson: false,
    testnet: true,
    facilitatorUrl: "https://x402.org/facilitator"
};

export default config;
```

You can pass the value with environment variables.

### How to Use
How to use tha package.

```ts
import type {TFacilitator, TRoutePaymentConfig} from "@/types/x402";
import X402 from "@bejibun/x402";

/**
 * setFacilitator(config?: TFacilitator)
 * 
 * setRoutePayment(config?: TRoutePaymentConfig)
 * 
 * setRequest(request: Bun.BunRequest) // Mandatory for request headers
 */
return X402
    .setFacilitator()
    .setRoutePayment()
    .setRequest(request)
    .middleware(() => {
        // your paid resource here
    });
```

## ☕ Support / Donate

If you find this project helpful and want to support it:

[![Donate](https://img.shields.io/badge/Donate-Support%20Me-orange?style=for-the-badge)](https://donatr.ee/bejibun-framework)

Or you can buy this `$BJBN (Bejibun)` tokens [here](https://pump.fun/coin/CQhbNnCGKfDaKXt8uE61i5DrBYJV7NPsCDD9vQgypump).