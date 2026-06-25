import type { TFacilitator, TRoutePaymentConfig } from "../types/x402";
export default class X402Builder {
    protected conf: Record<string, any>;
    protected _facilitator?: TFacilitator;
    protected request?: Bun.BunRequest;
    protected routePaymentConfig?: TRoutePaymentConfig;
    constructor();
    private get config();
    private get network();
    private get payTo();
    private get price();
    private get scheme();
    private get description();
    private get mimeType();
    private get facilitator();
    private buildHttpServer;
    setFacilitator(config?: TFacilitator): X402Builder;
    setRoutePayment(config?: TRoutePaymentConfig): X402Builder;
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
