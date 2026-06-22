import { x402HTTPResourceServer } from "@x402/core/http";
import App from "@bejibun/app";
import { defineValue, isEmpty } from "@bejibun/utils";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { BatchSettlementEvmScheme } from "@x402/evm/batch-settlement/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { UptoEvmScheme } from "@x402/evm/upto/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import fs from "fs";
import BunAdapter from "../builders/BunAdapter";
import X402Config from "../config/x402";
import X402Exception from "../exceptions/X402Exception";
export default class X402Builder {
    conf;
    facilitator;
    request;
    routePaymentConfig;
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
    get network() {
        return defineValue(this.routePaymentConfig?.network, defineValue(this.config.network, "eip155:1"));
    }
    get payTo() {
        return defineValue(this.routePaymentConfig?.payTo, defineValue(this.config.payTo, "0xdABe8750061410D35cE52EB2a418c8cB004788B3"));
    }
    get price() {
        return defineValue(this.routePaymentConfig?.price, defineValue(this.config.price, "$0.01"));
    }
    get scheme() {
        return defineValue(this.routePaymentConfig?.scheme, defineValue(this.config.scheme, "exact"));
    }
    get description() {
        return defineValue(this.routePaymentConfig?.description, "");
    }
    get mimeType() {
        return defineValue(this.routePaymentConfig?.mimeType, "application/json");
    }
    get facilitatorUrl() {
        return defineValue(this.facilitator?.url, defineValue(this.config?.facilitator?.url, "https://api.cdp.coinbase.com/platform/v2/x402"));
    }
    buildHttpServer(adapter) {
        const facilitatorClient = new HTTPFacilitatorClient({
            url: this.facilitatorUrl
        });
        const resourceServer = new x402ResourceServer(facilitatorClient);
        if (this.network.includes("eip155")) {
            resourceServer
                .register(this.network, new ExactEvmScheme())
                .register(this.network, new UptoEvmScheme())
                .register(this.network, new BatchSettlementEvmScheme(this.payTo));
        }
        if (this.network.includes("solana")) {
            resourceServer
                .register(this.network, new ExactSvmScheme());
        }
        const routeKey = `${adapter.getMethod()} ${adapter.getPath()}`;
        const routes = {
            [routeKey]: {
                accepts: {
                    scheme: this.scheme,
                    price: this.price,
                    network: this.network,
                    payTo: this.payTo
                },
                description: this.description,
                mimeType: this.mimeType
            }
        };
        return new x402HTTPResourceServer(resourceServer, routes);
    }
    setFacilitator(config) {
        this.facilitator = config;
        return this;
    }
    setRoutePayment(config) {
        this.routePaymentConfig = config;
        return this;
    }
    setRequest(request) {
        this.request = request;
        return this;
    }
    /**
     * Run x402 payment verification and settlement via @x402/core directly.
     *
     * Flow:
     *   - No payment header  -> 402 + PAYMENT-REQUIRED header
     *   - Invalid payment    -> 402 + PAYMENT-REQUIRED header (with error)
     *   - Valid payment      -> verifies, calls handler(), settles, attaches PAYMENT-RESPONSE header
     */
    async middleware(handler) {
        if (isEmpty(this.request))
            throw new X402Exception("setRequest() must be called before middleware().");
        const adapter = new BunAdapter(this.request);
        const httpServer = this.buildHttpServer(adapter);
        await httpServer.initialize();
        const context = {
            adapter,
            method: adapter.getMethod(),
            path: adapter.getPath(),
            paymentHeader: defineValue(adapter.getHeader("x-payment"), adapter.getHeader("PAYMENT-SIGNATURE"))
        };
        const result = await httpServer.processHTTPRequest(context);
        switch (result.type) {
            case "no-payment-required":
                // Route not protected (shouldn't happen, but handle gracefully)
                return handler();
            case "payment-error":
                // Framework should return the 402 response as instructed
                const { status, headers, body, isHtml } = result.response;
                return new Response(isEmpty(body) ? null : JSON.stringify(body), {
                    headers: {
                        ...headers,
                        "Content-Type": isHtml ? "text/html" : this.mimeType,
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Expose-Headers": "*"
                    },
                    status
                });
            case "payment-verified":
                // Run handler first, then settle
                const handlerResponse = await handler();
                // Only settle on successful handler responses (status < 400)
                if (handlerResponse.status < 400) {
                    const settlement = await httpServer.processSettlement(result.paymentPayload, result.paymentRequirements);
                    if (settlement.success) {
                        const headers = new Headers(handlerResponse.headers);
                        Object.entries(settlement.headers).forEach(([k, v]) => headers.set(k, v));
                        return new Response(handlerResponse.body, {
                            headers: {
                                ...headers,
                                "Content-Type": this.mimeType,
                                "Access-Control-Allow-Origin": "*",
                                "Access-Control-Expose-Headers": "*"
                            },
                            status: handlerResponse.status
                        });
                    }
                }
                return handlerResponse;
            default:
                throw new X402Exception("Whoops, something went wrong. Please try again...");
        }
    }
}
