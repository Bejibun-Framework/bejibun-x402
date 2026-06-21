import App from "@bejibun/app";
import { defineValue, isEmpty } from "@bejibun/utils";
import fs from "fs";
import { getAddress } from "viem";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { x402HTTPResourceServer } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { UptoEvmScheme } from "@x402/evm/upto/server";
import { BatchSettlementEvmScheme } from "@x402/evm/batch-settlement/server";
import X402Config from "../config/x402";
import X402Exception from "../exceptions/X402Exception";
/**
 * BunAdapter — implements @x402/core HTTPAdapter directly against Bun.BunRequest.
 */
class BunAdapter {
    req;
    _url;
    constructor(req) {
        this.req = req;
        this._url = new URL(req.url);
    }
    getHeader(name) {
        return this.req.headers.get(name) ?? undefined;
    }
    getMethod() {
        return this.req.method.toUpperCase();
    }
    getPath() {
        return this._url.pathname;
    }
    getUrl() {
        return this.req.url;
    }
    getAcceptHeader() {
        return this.req.headers.get("accept") ?? "";
    }
    getUserAgent() {
        return this.req.headers.get("user-agent") ?? "";
    }
    getQueryParam(name) {
        return this._url.searchParams.get(name) ?? undefined;
    }
    getQueryParams() {
        const params = {};
        this._url.searchParams.forEach((value, key) => {
            params[key] = value;
        });
        return params;
    }
}
export default class X402Builder {
    conf;
    payloadConfig = {};
    facilitatorConfig;
    bunRequest;
    routeConfig;
    constructor() {
        const configPath = App.Path.configPath("x402.ts");
        let config;
        if (fs.existsSync(configPath))
            config = require(configPath).default;
        else
            config = X402Config;
        this.conf = config;
    }
    get config() {
        if (isEmpty(this.conf))
            throw new X402Exception("There is no config provided.");
        return this.conf;
    }
    get _network() {
        return defineValue(this.conf?.network, "eip155:84532");
    }
    get _payTo() {
        const addr = defineValue(this.routeConfig?.payTo, defineValue(this.conf?.address, "0x0000000000000000000000000000000000000000"));
        return getAddress(addr);
    }
    get _price() {
        return defineValue(this.routeConfig?.price, defineValue(this.conf?.price, "$0.01"));
    }
    get _scheme() {
        return defineValue(this.routeConfig?.scheme, defineValue(this.conf?.scheme, "exact"));
    }
    get _mimeType() {
        return defineValue(this.routeConfig?.mimeType, defineValue(this.payloadConfig?.mimeType, "application/json"));
    }
    _buildHttpServer(adapter) {
        const facilitatorUrl = defineValue(this.facilitatorConfig?.url, defineValue(this.conf?.facilitatorUrl, "https://x402.org/facilitator"));
        const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
        const resourceServer = new x402ResourceServer(facilitatorClient)
            .register(this._network, new ExactEvmScheme())
            .register(this._network, new UptoEvmScheme())
            .register(this._network, new BatchSettlementEvmScheme(this._payTo));
        const routeKey = `${adapter.getMethod()} ${adapter.getPath()}`;
        const routes = {
            [routeKey]: {
                accepts: {
                    scheme: this._scheme,
                    price: this._price,
                    network: defineValue(this.routeConfig?.network, this._network),
                    payTo: this._payTo,
                },
                description: defineValue(this.routeConfig?.description, defineValue(this.payloadConfig?.description, "")),
                mimeType: this._mimeType
            },
        };
        return new x402HTTPResourceServer(resourceServer, routes);
    }
    // ── Public builder API ──────────────────────────────────────────────────
    setConfig(config) {
        this.payloadConfig = config;
        return this;
    }
    setFacilitator(config) {
        this.facilitatorConfig = config;
        return this;
    }
    /** No-op — kept for bejibun-core X402Middleware compatibility. */
    setPaywall(_config) {
        return this;
    }
    setRoute(config) {
        this.routeConfig = config;
        return this;
    }
    setRequest(request) {
        this.bunRequest = request;
        return this;
    }
    /**
     * Run x402 payment verification and settlement via @x402/core directly.
     *
     * Flow:
     *  - No payment header  → 402 + PAYMENT-REQUIRED header
     *  - Invalid payment    → 402 + PAYMENT-REQUIRED header (with error)
     *  - Valid payment      → verifies, calls handler(), settles, attaches PAYMENT-RESPONSE header
     */
    async middleware(handler) {
        if (!this.bunRequest) {
            throw new X402Exception("setRequest() must be called before middleware().");
        }
        const adapter = new BunAdapter(this.bunRequest);
        const httpServer = this._buildHttpServer(adapter);
        await httpServer.initialize();
        // Build the HTTPRequestContext that processHTTPRequest expects
        const context = {
            adapter,
            method: adapter.getMethod(),
            path: adapter.getPath(),
            paymentHeader: adapter.getHeader("x-payment") ?? adapter.getHeader("PAYMENT-SIGNATURE"),
        };
        const result = await httpServer.processHTTPRequest(context);
        if (result.type === "payment-error") {
            // Framework should return the 402 response as instructed
            const { status, headers, body } = result.response;
            return new Response(body !== undefined ? JSON.stringify(body) : null, {
                status,
                headers: {
                    ...headers,
                    "Content-Type": this._mimeType,
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Expose-Headers": "*"
                }
            });
        }
        if (result.type === "no-payment-required") {
            // Route not protected (shouldn't happen, but handle gracefully)
            return handler();
        }
        // type === "payment-verified" — run handler first, then settle
        const handlerResponse = await handler();
        // Only settle on successful handler responses (status < 400)
        if (handlerResponse.status < 400) {
            const settlement = await httpServer.processSettlement(result.paymentPayload, result.paymentRequirements);
            if (settlement.success) {
                const headers = new Headers(handlerResponse.headers);
                Object.entries(settlement.headers).forEach(([k, v]) => headers.set(k, v));
                return new Response(handlerResponse.body, {
                    status: handlerResponse.status,
                    headers: {
                        ...headers,
                        "Content-Type": this._mimeType,
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Expose-Headers": "*"
                    }
                });
            }
        }
        return handlerResponse;
    }
}
