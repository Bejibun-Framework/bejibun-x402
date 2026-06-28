import { facilitator } from "@coinbase/x402";
const config = {
    scheme: "exact",
    price: "$1",
    networks: [
        {
            network: "eip155:8453",
            payTo: "0xdABe8750061410D35cE52EB2a418c8cB004788B3"
        },
        {
            network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            payTo: "GAnoyvy9p3QFyxikWDh9hA3fmSk2uiPLNWyQ579cckMn"
        }
    ],
    facilitator: facilitator
};
export default config;
