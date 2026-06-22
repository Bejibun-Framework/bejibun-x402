import type {TScheme} from "@/types/x402";

const config: Record<string, any> = {
    version: 2,
    scheme: "exact" as TScheme,
    price: "$0.01",
    network: "eip155:8453",
    payTo: "0xdABe8750061410D35cE52EB2a418c8cB004788B3",
    facilitator: {
        url: "https://api.cdp.coinbase.com/platform/v2/x402"
    }
};

export default config;