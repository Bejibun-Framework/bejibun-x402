import type {TScheme} from "@/types/x402";

const config: Record<string, any> = {
    version: 2,
    scheme: "exact" as TScheme,
    price: "$0.01",
    networks: {
        evm: {
            network: "eip155:8453",
            payTo: "0xdABe8750061410D35cE52EB2a418c8cB004788B3"
        },
        svm: {
            network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            payTo: "2PxBfRNZgjFUpYiJsDZsDYnDiJcGkz6Zes2xAjuzGywZ"
        }
    },
    facilitator: {
        url: "https://api.cdp.coinbase.com/platform/v2/x402"
    }
};

export default config;