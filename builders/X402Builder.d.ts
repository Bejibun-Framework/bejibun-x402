export type TScheme = "exact" | "upto" | "batch-settlement";
export type TX402Config = {
    description?: string;
    mimeType?: string;
};
export type TFacilitator = {
    url?: string;
};
export type TPaywall = Record<string, never>;
export type TRoutePaymentConfig = {
    scheme: TScheme;
    price: string;
    network?: string;
    payTo?: string;
    description?: string;
    mimeType?: string;
};
export default class X402Builder {
    protected conf: Record<string, any>;
    protected payloadConfig?: TX402Config;
    protected facilitatorConfig?: TFacilitator;
    protected bunRequest?: Bun.BunRequest;
    protected routeConfig?: TRoutePaymentConfig;
    constructor();
    private get config();
    private get _network();
    private get _payTo();
    private get _price();
    private get _scheme();
    private get _mimeType();
    private _buildHttpServer;
    setConfig(config?: TX402Config): X402Builder;
    setFacilitator(config?: TFacilitator): X402Builder;
    /** No-op — kept for bejibun-core X402Middleware compatibility. */
    setPaywall(_config?: TPaywall): X402Builder;
    setRoute(config: TRoutePaymentConfig): X402Builder;
    setRequest(request: Bun.BunRequest): X402Builder;
    /**
     * Run x402 payment verification and settlement via @x402/core directly.
     *
     * Flow:
     *  - No payment header  → 402 + PAYMENT-REQUIRED header
     *  - Invalid payment    → 402 + PAYMENT-REQUIRED header (with error)
     *  - Valid payment      → verifies, calls handler(), settles, attaches PAYMENT-RESPONSE header
     */
    middleware(handler: () => Promise<Response> | Response): Promise<Response>;
}
