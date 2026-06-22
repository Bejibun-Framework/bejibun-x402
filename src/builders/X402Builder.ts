import type {HTTPProcessResult, HTTPRequestContext, RoutesConfig} from "@x402/core/http";
import type {TFacilitator, TRoutePaymentConfig, TScheme} from "@/types/x402";
import {x402HTTPResourceServer} from "@x402/core/http";
import App from "@bejibun/app";
import {defineValue, isEmpty} from "@bejibun/utils";
import {HTTPFacilitatorClient, x402ResourceServer} from "@x402/core/server";
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
    protected facilitator?: TFacilitator;
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

    private get network(): `${string}:${string}` {
        return defineValue(
            this.routePaymentConfig?.network,
            defineValue(
                this.config.network,
                "eip155:1"
            )
        );
    }

    private get payTo(): string {
        return defineValue(
            this.routePaymentConfig?.payTo,
            defineValue(
                this.config.payTo,
                "0xdABe8750061410D35cE52EB2a418c8cB004788B3"
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

    private get scheme(): TScheme {
        return defineValue(
            this.routePaymentConfig?.scheme,
            defineValue(
                this.config.scheme,
                "exact"
            )
        );
    }

    private get description(): string {
        return defineValue(this.routePaymentConfig?.description, "");
    }

    private get mimeType(): string {
        return defineValue(this.routePaymentConfig?.mimeType, "application/json");
    }

    private get facilitatorUrl(): string {
        return defineValue(
            this.facilitator?.url,
            defineValue(
                this.config?.facilitator?.url,
                "https://api.cdp.coinbase.com/platform/v2/x402"
            )
        );
    }

    private buildHttpServer(adapter: BunAdapter): x402HTTPResourceServer {
        const facilitatorClient: HTTPFacilitatorClient = new HTTPFacilitatorClient({
            url: this.facilitatorUrl
        });

        const resourceServer: x402ResourceServer = new x402ResourceServer(facilitatorClient);

        if (this.network.includes("eip155")) {
            resourceServer
                .register(this.network, new ExactEvmScheme())
                .register(this.network, new UptoEvmScheme())
                .register(this.network, new BatchSettlementEvmScheme(this.payTo as `0x${string}`));
        }

        if (this.network.includes("solana")) {
            resourceServer
                .register(this.network, new ExactSvmScheme());
        }

        const routeKey: string = `${adapter.getMethod()} ${adapter.getPath()}`;

        const routes: RoutesConfig = {
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

    public setFacilitator(config?: TFacilitator): X402Builder {
        this.facilitator = config;

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

        await httpServer.initialize();

        const context: HTTPRequestContext = {
            adapter,
            method: adapter.getMethod(),
            path: adapter.getPath(),
            paymentHeader: defineValue(
                adapter.getHeader("x-payment"),
                adapter.getHeader("PAYMENT-SIGNATURE")
            )
        };

        const result: HTTPProcessResult = await httpServer.processHTTPRequest(context);

        switch (result.type) {
            case "no-payment-required":
                // Route not protected (shouldn't happen, but handle gracefully)
                return handler();

            case "payment-error":
                // Framework should return the 402 response as instructed
                const {status, headers, body, isHtml} = result.response;

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
                    const settlement = await httpServer.processSettlement(
                        result.paymentPayload,
                        result.paymentRequirements
                    );

                    if (settlement.success) {
                        const headers = new Headers(handlerResponse.headers);

                        Object.entries(settlement.headers).forEach(([k, v]) => headers.set(k, v as string));

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
