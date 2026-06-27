import type { TFacilitator, TRoutePayment } from "../types/x402";
export default class X402Builder {
    protected conf: Record<string, any>;
    protected _facilitator?: TFacilitator;
    protected request?: Bun.BunRequest;
    protected routePaymentConfig?: TRoutePayment;
    private static _serverCache;
    private static _initPromises;
    constructor();
    private get config();
    private get scheme();
    private get price();
    private get description();
    private get mimeType();
    private get facilitator();
    /**
     * Resolve the accepts array for a route.
     *
     * Priority order:
     *   1. routePaymentConfig.accepts  — explicit multi-network list
     *   2. routePaymentConfig single-network fields (network + payTo)
     *   3. config.networks             — both EVM + SVM from config file
     *   4. config single-network fields (legacy)
     *   5. built-in defaults (EVM Base + Solana mainnet)
     */
    private get accepts();
    private buildHttpServer;
    setFacilitator(config?: TFacilitator): X402Builder;
    setRoutePayment(config?: TRoutePayment): X402Builder;
    setRequest(request: Bun.BunRequest): X402Builder;
    /**
     * Run x402 payment verification and settlement via @x402/core directly.
     *
     * Flow:
     *   - No payment header  -> 402 + PAYMENT-REQUIRED header
     *   - Invalid payment    -> 402 + PAYMENT-REQUIRED header (with error)
     *   - Valid payment      -> verifies, calls handler(), settles, attaches PAYMENT-RESPONSE header
     */
    middleware(handler: () => Promise<Response>): Promise<Response>;
}
