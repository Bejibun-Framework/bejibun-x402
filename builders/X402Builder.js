import App from "@bejibun/app";
import { defineValue, isEmpty, isNotEmpty } from "@bejibun/utils";
import { facilitator as CoinbaseFacilitator } from "@coinbase/x402";
import { x402HTTPResourceServer } from "@x402/core/http";
import { HTTPFacilitatorClient, getFacilitatorResponseError, x402ResourceServer } from "@x402/core/server";
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
    _facilitator;
    request;
    routePaymentConfig;
    // Static cache: persists across all X402Builder instances (new X402Builder() per request)
    static _serverCache = new Map();
    static _initPromises = new Map();
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
    get scheme() {
        return defineValue(this.routePaymentConfig?.scheme, defineValue(this.config.scheme, "exact"));
    }
    get price() {
        return defineValue(this.routePaymentConfig?.price, defineValue(this.config.price, "$1"));
    }
    get description() {
        return defineValue(this.routePaymentConfig?.description, "Monetized endpoint with x402 protocol.");
    }
    get mimeType() {
        return defineValue(this.routePaymentConfig?.mimeType, "application/json");
    }
    get facilitator() {
        return defineValue(this._facilitator, defineValue(this.config?.facilitator, CoinbaseFacilitator));
    }
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
    get accepts() {
        // 1. Explicit accepts array on the route config
        if (isNotEmpty(this.routePaymentConfig?.accepts)) {
            return this.routePaymentConfig.accepts.map((entry) => ({
                scheme: defineValue(entry.scheme, this.scheme),
                price: defineValue(entry.price, this.price),
                network: entry.network,
                payTo: entry.payTo,
                description: defineValue(entry.description, this.description),
                mimeType: defineValue(entry.mimeType, this.mimeType)
            }));
        }
        // 2. Single-network shorthand on the route config
        if (isNotEmpty(this.routePaymentConfig?.network) && isNotEmpty(this.routePaymentConfig?.payTo)) {
            return [{
                    scheme: this.scheme,
                    price: this.price,
                    network: this.routePaymentConfig.network,
                    payTo: this.routePaymentConfig.payTo,
                    description: this.description,
                    mimeType: this.mimeType
                }];
        }
        // 3. Multi-network block in config file
        if (isNotEmpty(this.config.networks)) {
            return this.config.networks.map((entry) => ({
                scheme: this.scheme,
                price: this.price,
                network: entry.network,
                payTo: entry.payTo,
                description: this.description,
                mimeType: this.mimeType
            }));
        }
        // 4. Built-in defaults
        const evmPayTo = "0xdABe8750061410D35cE52EB2a418c8cB004788B3";
        const svmPayTo = "GAnoyvy9p3QFyxikWDh9hA3fmSk2uiPLNWyQ579cckMn";
        const evmNetworks = ["eip155:8453", "eip155:137", "eip155:42161", "eip155:480"];
        const svmNetworks = ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"];
        return [
            ...evmNetworks.map((network) => ({
                scheme: this.scheme,
                price: this.price,
                network,
                payTo: evmPayTo,
                description: this.description,
                mimeType: this.mimeType
            })),
            ...svmNetworks.map((network) => ({
                scheme: "exact",
                price: this.price,
                network,
                payTo: svmPayTo,
                description: this.description,
                mimeType: this.mimeType
            }))
        ];
    }
    async buildHttpServer(adapter) {
        const cacheKey = `${adapter.getMethod()} ${adapter.getPath()}:${JSON.stringify(this.accepts)}`;
        // Return already-initialized instance immediately
        if (X402Builder._serverCache.has(cacheKey))
            return X402Builder._serverCache.get(cacheKey);
        // If another request is already initializing this same key, wait for it
        // prevents duplicate servers with different feePayers being built simultaneously
        if (X402Builder._initPromises.has(cacheKey))
            return X402Builder._initPromises.get(cacheKey);
        const initPromise = (async () => {
            try {
                const facilitatorClient = new HTTPFacilitatorClient(this.facilitator);
                const resourceServer = new x402ResourceServer(facilitatorClient);
                const registeredNetworks = new Set();
                for (const entry of this.accepts) {
                    if (registeredNetworks.has(entry.network))
                        continue;
                    registeredNetworks.add(entry.network);
                    if (entry.network.startsWith("eip155:")) {
                        const evmPayTo = entry.payTo;
                        resourceServer
                            .register(entry.network, new ExactEvmScheme())
                            .register(entry.network, new UptoEvmScheme())
                            .register(entry.network, new BatchSettlementEvmScheme(evmPayTo));
                    }
                    if (entry.network.startsWith("solana:")) {
                        resourceServer.register(entry.network, new ExactSvmScheme());
                    }
                }
                const routeKey = `${adapter.getMethod()} ${adapter.getPath()}`;
                const routes = {
                    [routeKey]: {
                        accepts: this.accepts.map(entry => ({
                            scheme: entry.scheme,
                            payTo: entry.payTo,
                            price: entry.price,
                            network: entry.network
                        })),
                        description: this.description,
                        mimeType: this.mimeType
                    }
                };
                const httpServer = new x402HTTPResourceServer(resourceServer, routes);
                // initialize ONCE — this locks in the SVM feePayer
                try {
                    await httpServer.initialize();
                }
                catch (error) {
                    const facilitatorError = getFacilitatorResponseError(error);
                    if (isNotEmpty(facilitatorError)) {
                        throw new X402Exception(facilitatorError.message);
                    }
                }
                X402Builder._serverCache.set(cacheKey, httpServer);
                return httpServer;
            }
            finally {
                // Always clean up the in-flight promise, success or failure
                X402Builder._initPromises.delete(cacheKey);
            }
        })();
        X402Builder._initPromises.set(cacheKey, initPromise);
        return initPromise;
    }
    setFacilitator(config) {
        this._facilitator = config;
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
        // buildHttpServer is now async and handles initialize() internally, only once per route
        const httpServer = await this.buildHttpServer(adapter);
        const context = {
            adapter,
            path: adapter.getPath(),
            method: adapter.getMethod(),
            paymentHeader: defineValue(adapter.getHeader("payment-signature"), adapter.getHeader("x-payment"))
        };
        let result = {
            type: "no-payment-required"
        };
        try {
            result = await httpServer.processHTTPRequest(context);
        }
        catch (error) {
            throw new X402Exception(error.message);
        }
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "*"
        };
        switch (result.type) {
            case "no-payment-required":
                return handler();
            case "payment-error": {
                const { status, headers, body, isHtml } = result.response;
                return new Response(isEmpty(body) ? null : JSON.stringify(body), {
                    headers: {
                        ...headers,
                        "Content-Type": isHtml ? "text/html" : this.mimeType,
                        ...corsHeaders
                    },
                    status
                });
            }
            case "payment-verified": {
                const { cancellationDispatcher, paymentPayload, paymentRequirements, declaredExtensions } = result;
                // Run handler, cancel on throw
                let handlerResponse;
                try {
                    handlerResponse = await handler();
                }
                catch (error) {
                    await cancellationDispatcher?.cancel({ reason: "handler_threw", error });
                    throw new X402Exception(error.message);
                }
                // Cancel settlement on handler error responses (4xx/5xx)
                if (handlerResponse.status >= 400) {
                    await cancellationDispatcher?.cancel({
                        reason: "handler_failed",
                        responseStatus: handlerResponse.status
                    });
                    return handlerResponse;
                }
                // Read body for settlement context
                const responseBody = await handlerResponse.arrayBuffer();
                const responseHeaders = {};
                handlerResponse.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });
                // Settle payment
                try {
                    const settlement = await httpServer.processSettlement(paymentPayload, paymentRequirements, declaredExtensions, {
                        request: context,
                        responseBody: Buffer.from(responseBody),
                        responseHeaders
                    });
                    if (!settlement.success) {
                        const { status, headers, body, isHtml } = settlement.response;
                        return new Response(isEmpty(body) ? null : JSON.stringify(body), {
                            headers: {
                                ...headers,
                                "Content-Type": isHtml ? "text/html" : this.mimeType,
                                ...corsHeaders
                            },
                            status
                        });
                    }
                    // Merge settlement headers into response
                    const mergedHeaders = new Headers(handlerResponse.headers);
                    Object.entries(settlement.headers).forEach(([k, v]) => mergedHeaders.set(k, v));
                    Object.entries(corsHeaders).forEach(([k, v]) => mergedHeaders.set(k, v));
                    mergedHeaders.set("Content-Type", this.mimeType);
                    return new Response(responseBody, {
                        headers: mergedHeaders,
                        status: handlerResponse.status
                    });
                }
                catch (error) {
                    const facilitatorError = getFacilitatorResponseError(error);
                    if (isNotEmpty(facilitatorError)) {
                        return new Response(JSON.stringify({
                            error: facilitatorError.message
                        }), {
                            headers: {
                                "Content-Type": "application/json",
                                ...corsHeaders
                            },
                            status: 502
                        });
                    }
                    // Fallback: return 402 like Express does
                    return new Response(JSON.stringify({}), {
                        headers: {
                            "Content-Type": "application/json",
                            ...corsHeaders
                        },
                        status: 402
                    });
                }
            }
            default:
                throw new X402Exception("Whoops, something went wrong. Please try again...");
        }
    }
}
