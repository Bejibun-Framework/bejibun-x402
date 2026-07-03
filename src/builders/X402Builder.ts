import type {HTTPProcessResult, HTTPRequestContext, PaymentOption, RoutesConfig} from "@x402/core/http";
import type {TFacilitator, TNetwork, TNetworkPayment, TPrice, TRoutePayment, TScheme} from "@/types/x402";
import App from "@bejibun/app";
import {defineValue, isEmpty, isNotEmpty} from "@bejibun/utils";
import {facilitator as CoinbaseFacilitator} from "@coinbase/x402";
import {x402HTTPResourceServer} from "@x402/core/http";
import {
    FacilitatorResponseError,
    HTTPFacilitatorClient,
    getFacilitatorResponseError,
    x402ResourceServer
} from "@x402/core/server";
import {BatchSettlementEvmScheme} from "@x402/evm/batch-settlement/server";
import {ExactEvmScheme} from "@x402/evm/exact/server";
import {UptoEvmScheme} from "@x402/evm/upto/server";
import {ExactSvmScheme} from "@x402/svm/exact/server";
import fs from "fs";
import BunAdapter from "@/builders/BunAdapter";
import X402Config from "@/config/x402";
import X402Exception from "@/exceptions/X402Exception";

export default class X402Builder {
    protected conf: Record<string, any>;
    protected _facilitator?: TFacilitator;
    protected request?: Bun.BunRequest;
    protected routePaymentConfig?: TRoutePayment;

    // Static cache: persists across all X402Builder instances (new X402Builder() per request)
    private static _serverCache = new Map<string, x402HTTPResourceServer>();
    private static _initPromises = new Map<string, Promise<x402HTTPResourceServer>>();

    public constructor() {
        const configPath: string = App.Path.configPath("x402.ts");

        let config: any;

        if (fs.existsSync(configPath)) config = require(configPath).default;
        else config = X402Config;

        this.conf = config;
    }

    private get config(): Record<string, any> {
        if (isEmpty(this.conf)) throw new X402Exception("There is no config provided.");

        return this.conf;
    }

    private get scheme(): TScheme {
        return defineValue(
            this.routePaymentConfig?.scheme,
            defineValue(
                this.config.scheme,
                "exact"
            )
        );
    }

    private get price(): TPrice {
        return defineValue(
            this.routePaymentConfig?.price,
            defineValue(
                this.config.price,
                "$1"
            )
        );
    }

    private get description(): string {
        return defineValue(this.routePaymentConfig?.description, "Monetized endpoint with x402 protocol.");
    }

    private get mimeType(): string {
        return defineValue(this.routePaymentConfig?.mimeType, "application/json");
    }

    private get facilitator(): TFacilitator {
        return defineValue(
            this._facilitator,
            defineValue(
                this.config?.facilitator,
                CoinbaseFacilitator
            )
        );
    }

    /**
     * Resolve the accepts array for a route.
     *
     * Priority order:
     *   1. routePaymentConfig.accepts  — explicit multi-network list
     *   2. routePaymentConfig single-network fields (network + payTo)
     *   3. config.networks             — both EVM + SVM from config file
     *   4. built-in defaults (EVM Base + Solana mainnet)
     */
    private get accepts(): Array<TNetworkPayment> {
        // 1. Explicit accepts array on the route config
        if (isNotEmpty(this.routePaymentConfig?.accepts)) {
            return this.routePaymentConfig!.accepts!.map((entry: TNetworkPayment) => ({
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
                network: this.routePaymentConfig!.network!,
                payTo: this.routePaymentConfig!.payTo!,
                description: this.description,
                mimeType: this.mimeType
            }];
        }

        // 3. Multi-network block in config file
        if (isNotEmpty(this.config.networks)) {
            return this.config.networks!.map((entry: {
                network: TNetwork;
                payTo: string;
            }) => ({
                scheme: this.scheme,
                price: this.price,
                network: entry.network,
                payTo: entry.payTo,
                description: this.description,
                mimeType: this.mimeType
            }));
        }

        // 4. Built-in defaults
        const evmPayTo: string = "0xdABe8750061410D35cE52EB2a418c8cB004788B3";
        const svmPayTo: string = "GAnoyvy9p3QFyxikWDh9hA3fmSk2uiPLNWyQ579cckMn";

        const evmNetworks: Array<TNetwork> = ["eip155:8453", "eip155:137", "eip155:42161", "eip155:480"];
        const svmNetworks: Array<TNetwork> = ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"];

        return [
            ...evmNetworks.map((network: TNetwork) => ({
                scheme: this.scheme,
                price: this.price,
                network,
                payTo: evmPayTo,
                description: this.description,
                mimeType: this.mimeType
            })),
            ...svmNetworks.map((network: TNetwork) => ({
                scheme: "exact" as TScheme,
                price: this.price,
                network,
                payTo: svmPayTo,
                description: this.description,
                mimeType: this.mimeType
            }))
        ];
    }

    private async buildHttpServer(adapter: BunAdapter): Promise<x402HTTPResourceServer> {
        const cacheKey = `${adapter.getMethod()} ${adapter.getPath()}:${JSON.stringify(this.accepts)}`;

        // Return already-initialized instance immediately
        if (X402Builder._serverCache.has(cacheKey)) return X402Builder._serverCache.get(cacheKey)!;

        // If another request is already initializing this same key, wait for it
        // prevents duplicate servers with different feePayers being built simultaneously
        if (X402Builder._initPromises.has(cacheKey)) return X402Builder._initPromises.get(cacheKey)!;

        const initPromise = (async (): Promise<x402HTTPResourceServer> => {
            try {
                const facilitatorClient: HTTPFacilitatorClient = new HTTPFacilitatorClient(this.facilitator);
                const resourceServer: x402ResourceServer = new x402ResourceServer(facilitatorClient);
                const registeredNetworks = new Set<string>();

                for (const entry of this.accepts) {
                    if (registeredNetworks.has(entry.network)) continue;
                    registeredNetworks.add(entry.network);

                    if (entry.network.startsWith("eip155:")) {
                        const evmPayTo = entry.payTo as `0x${string}`;
                        resourceServer
                            .register(entry.network, new ExactEvmScheme())
                            .register(entry.network, new UptoEvmScheme())
                            .register(entry.network, new BatchSettlementEvmScheme(evmPayTo));
                    }

                    if (entry.network.startsWith("solana:")) {
                        resourceServer.register(entry.network, new ExactSvmScheme());
                    }
                }

                const routeKey: string = `${adapter.getMethod()} ${adapter.getPath()}`;

                const routes: RoutesConfig = {
                    [routeKey]: {
                        accepts: this.accepts.map(entry => ({
                            scheme: entry.scheme,
                            payTo: entry.payTo,
                            price: entry.price,
                            network: entry.network
                        })) as Array<PaymentOption>,
                        description: this.description,
                        mimeType: this.mimeType
                    }
                };

                const httpServer: x402HTTPResourceServer = new x402HTTPResourceServer(resourceServer, routes);

                // initialize ONCE — this locks in the SVM feePayer
                try {
                    await httpServer.initialize();
                } catch (error: any) {
                    const facilitatorError = getFacilitatorResponseError(error);
                    if (isNotEmpty(facilitatorError)) {
                        throw new X402Exception((facilitatorError as FacilitatorResponseError).message);
                    }
                }

                X402Builder._serverCache.set(cacheKey, httpServer);

                return httpServer;
            } finally {
                // Always clean up the in-flight promise, success or failure
                X402Builder._initPromises.delete(cacheKey);
            }
        })();

        X402Builder._initPromises.set(cacheKey, initPromise);

        return initPromise;
    }

    public setFacilitator(config?: TFacilitator): X402Builder {
        this._facilitator = config;

        return this;
    }

    public setRoutePayment(config?: TRoutePayment): X402Builder {
        this.routePaymentConfig = config;

        return this;
    }

    public setRequest(request: Bun.BunRequest): X402Builder {
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
    public async middleware(handler: () => Promise<Response>): Promise<Response> {
        if (isEmpty(this.request)) throw new X402Exception("setRequest() must be called before middleware().");

        const adapter: BunAdapter = new BunAdapter(this.request as Bun.BunRequest);

        // buildHttpServer is now async and handles initialize() internally, only once per route
        const httpServer: x402HTTPResourceServer = await this.buildHttpServer(adapter);

        const context: HTTPRequestContext = {
            adapter,
            path: adapter.getPath(),
            method: adapter.getMethod(),
            paymentHeader: defineValue(
                adapter.getHeader("payment-signature"),
                adapter.getHeader("x-payment")
            )
        };

        let result: HTTPProcessResult = {
            type: "no-payment-required"
        };
        try {
            result = await httpServer.processHTTPRequest(context);
        } catch (error: any) {
            throw new X402Exception(error.message);
        }

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "*"
        };

        switch (result.type) {
            case "no-payment-required":
                return await handler();

            case "payment-error": {
                const {status, headers, body, isHtml} = result.response;

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
                const {cancellationDispatcher, paymentPayload, paymentRequirements, declaredExtensions} = result;

                // Run handler, cancel on throw
                let handlerResponse: Response;
                try {
                    handlerResponse = await handler();
                } catch (error: any) {
                    await cancellationDispatcher?.cancel({reason: "handler_threw", error});

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
                const responseHeaders: Record<string, string> = {};
                handlerResponse.headers.forEach((value: string, key: string) => {
                    responseHeaders[key] = value;
                });

                // Settle payment
                try {
                    const settlement = await httpServer.processSettlement(
                        paymentPayload,
                        paymentRequirements,
                        declaredExtensions,
                        {
                            request: context,
                            responseBody: Buffer.from(responseBody),
                            responseHeaders
                        }
                    );

                    if (!settlement.success) {
                        const {status, headers, body, isHtml} = settlement.response;
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
                    Object.entries(settlement.headers).forEach(([k, v]) => mergedHeaders.set(k, v as string));
                    Object.entries(corsHeaders).forEach(([k, v]) => mergedHeaders.set(k, v));
                    mergedHeaders.set("Content-Type", this.mimeType);

                    return new Response(responseBody, {
                        headers: mergedHeaders,
                        status: handlerResponse.status
                    });
                } catch (error: any) {
                    const facilitatorError = getFacilitatorResponseError(error);
                    if (isNotEmpty(facilitatorError)) {
                        return new Response(JSON.stringify({
                            error: (facilitatorError as FacilitatorResponseError).message
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