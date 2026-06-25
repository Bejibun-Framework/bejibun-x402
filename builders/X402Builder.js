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
    _facilitator;
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
    get scheme() {
        return defineValue(this.routePaymentConfig?.scheme, defineValue(this.config.scheme, "exact"));
    }
    get price() {
        return defineValue(this.routePaymentConfig?.price, defineValue(this.config.price, "$0.01"));
    }
    get description() {
        return defineValue(this.routePaymentConfig?.description, "");
    }
    get mimeType() {
        return defineValue(this.routePaymentConfig?.mimeType, "application/json");
    }
    get facilitator() {
        return defineValue(this._facilitator, defineValue(this.config?.facilitator, {
            url: "https://api.cdp.coinbase.com/platform/v2/x402"
        }));
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
        if (!isEmpty(this.routePaymentConfig?.accepts)) {
            return this.routePaymentConfig.accepts.map(entry => ({
                scheme: defineValue(entry.scheme, this.scheme),
                price: defineValue(entry.price, this.price),
                network: entry.network,
                payTo: entry.payTo,
                description: defineValue(entry.description, this.description),
                mimeType: defineValue(entry.mimeType, this.mimeType)
            }));
        }
        // 2. Single-network shorthand on the route config
        if (!isEmpty(this.routePaymentConfig?.network) && !isEmpty(this.routePaymentConfig?.payTo)) {
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
        if (!isEmpty(this.config.networks)) {
            const networks = this.config.networks;
            const result = [];
            if (!isEmpty(networks.evm?.network) && !isEmpty(networks.evm?.payTo)) {
                result.push({
                    scheme: this.scheme,
                    price: this.price,
                    network: networks.evm.network,
                    payTo: networks.evm.payTo,
                    description: this.description,
                    mimeType: this.mimeType
                });
            }
            if (!isEmpty(networks.svm?.network) && !isEmpty(networks.svm?.payTo)) {
                result.push({
                    scheme: defineValue(networks.svm.scheme, "exact"),
                    price: this.price,
                    network: networks.svm.network,
                    payTo: networks.svm.payTo,
                    description: this.description,
                    mimeType: this.mimeType
                });
            }
            if (!isEmpty(result))
                return result;
        }
        // 4. Legacy single-network fields in config file
        if (!isEmpty(this.config.network) && !isEmpty(this.config.payTo)) {
            return [{
                    scheme: this.scheme,
                    price: this.price,
                    network: this.config.network,
                    payTo: this.config.payTo,
                    description: this.description,
                    mimeType: this.mimeType
                }];
        }
        // 5. Built-in defaults: Base mainnet + Solana mainnet
        return [
            {
                scheme: this.scheme,
                price: this.price,
                network: "eip155:8453",
                payTo: "0xdABe8750061410D35cE52EB2a418c8cB004788B3",
                description: this.description,
                mimeType: this.mimeType
            },
            {
                scheme: "exact",
                price: this.price,
                network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
                payTo: "2PxBfRNZgjFUpYiJsDZsDYnDiJcGkz6Zes2xAjuzGywZ",
                description: this.description,
                mimeType: this.mimeType
            }
        ];
    }
    buildHttpServer(adapter) {
        const facilitatorClient = new HTTPFacilitatorClient(this.facilitator);
        const resourceServer = new x402ResourceServer(facilitatorClient);
        // Register schemes for every network in the accepts list
        const registeredNetworks = new Set();
        for (const entry of this.accepts) {
            if (registeredNetworks.has(entry.network))
                continue;
            registeredNetworks.add(entry.network);
            if (entry.network.includes("eip155")) {
                const evmPayTo = entry.payTo;
                resourceServer
                    .register(entry.network, new ExactEvmScheme())
                    .register(entry.network, new UptoEvmScheme())
                    .register(entry.network, new BatchSettlementEvmScheme(evmPayTo));
            }
            if (entry.network.includes("solana")) {
                resourceServer
                    .register(entry.network, new ExactSvmScheme());
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
        return new x402HTTPResourceServer(resourceServer, routes);
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
