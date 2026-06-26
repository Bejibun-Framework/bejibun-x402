import type {HTTPProcessResult, HTTPRequestContext, PaymentOption, RoutesConfig} from "@x402/core/http";
import type {TFacilitator, TNetworkPaymentConfig, TRoutePaymentConfig, TScheme} from "@/types/x402";
import {x402HTTPResourceServer} from "@x402/core/http";
import App from "@bejibun/app";
import {defineValue, isEmpty, isNotEmpty} from "@bejibun/utils";
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
    protected routePaymentConfig?: TRoutePaymentConfig;

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

    private get price(): string {
        return defineValue(
            this.routePaymentConfig?.price,
            defineValue(
                this.config.price,
                "$0.01"
            )
        );
    }

    private get description(): string {
        return defineValue(this.routePaymentConfig?.description, "");
    }

    private get mimeType(): string {
        return defineValue(this.routePaymentConfig?.mimeType, "application/json");
    }

    private get facilitator(): TFacilitator {
        return defineValue(
            this._facilitator,
            defineValue(
                this.config?.facilitator,
                {
                    url: "https://api.cdp.coinbase.com/platform/v2/x402"
                }
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
     *   4. config single-network fields (legacy)
     *   5. built-in defaults (EVM Base + Solana mainnet)
     */
    private get accepts(): TNetworkPaymentConfig[] {
        // 1. Explicit accepts array on the route config
        if (!isEmpty(this.routePaymentConfig?.accepts)) {
            return this.routePaymentConfig!.accepts!.map(entry => ({
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
                network: this.routePaymentConfig!.network!,
                payTo: this.routePaymentConfig!.payTo!,
                description: this.description,
                mimeType: this.mimeType
            }];
        }

        // 3. Multi-network block in config file
        if (!isEmpty(this.config.networks)) {
            const networks = this.config.networks;
            const result: TNetworkPaymentConfig[] = [];

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
                    scheme: defineValue(networks.svm.scheme, "exact") as TScheme,
                    price: this.price,
                    network: networks.svm.network,
                    payTo: networks.svm.payTo,
                    description: this.description,
                    mimeType: this.mimeType
                });
            }

            if (!isEmpty(result)) return result;
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
                payTo: "GAnoyvy9p3QFyxikWDh9hA3fmSk2uiPLNWyQ579cckMn",
                description: this.description,
                mimeType: this.mimeType
            }
        ];
    }

    private buildHttpServer(adapter: BunAdapter): x402HTTPResourceServer {
        const facilitatorClient: HTTPFacilitatorClient = new HTTPFacilitatorClient(this.facilitator);

        const resourceServer: x402ResourceServer = new x402ResourceServer(facilitatorClient);

        // Register schemes for every network in the accepts list
        const registeredNetworks = new Set<string>();

        for (const entry of this.accepts) {
            if (registeredNetworks.has(entry.network)) continue;
            registeredNetworks.add(entry.network);

            if (entry.network.includes("eip155")) {
                const evmPayTo = entry.payTo as `0x${string}`;

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

        return new x402HTTPResourceServer(resourceServer, routes);
    }

    public setFacilitator(config?: TFacilitator): X402Builder {
        this._facilitator = config;

        return this;
    }

    public setRoutePayment(config?: TRoutePaymentConfig): X402Builder {
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
        const httpServer: x402HTTPResourceServer = this.buildHttpServer(adapter);

        try {
            await httpServer.initialize();
        } catch (error: any) {
            const facilitatorError = getFacilitatorResponseError(error);

            if (isNotEmpty(facilitatorError)) throw new X402Exception((facilitatorError as FacilitatorResponseError).message);
        }

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
                return handler();

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
