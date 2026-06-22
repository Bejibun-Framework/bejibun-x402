import type {HTTPAdapter} from "@x402/core/http";
import {defineValue} from "@bejibun/utils";

/**
 * BunAdapter —- Implements @x402/core HTTPAdapter directly against Bun.BunRequest.
 */
export default class BunAdapter implements HTTPAdapter {
    private readonly request: Bun.BunRequest;
    private readonly url: URL;

    public constructor(request: Bun.BunRequest) {
        this.request = request;
        this.url = new URL(this.request.url);
    }

    public getHeader(name: string): string | undefined {
        return defineValue(this.request.headers.get(name), undefined);
    }

    public getMethod(): string {
        return this.request.method.toUpperCase();
    }

    public getPath(): string {
        return this.url.pathname;
    }

    public getUrl(): string {
        return this.request.url;
    }

    public getAcceptHeader(): string {
        return defineValue(this.request.headers.get("accept"), "");
    }

    public getUserAgent(): string {
        return defineValue(this.request.headers.get("user-agent"), "");
    }

    public getQueryParam(name: string): string | undefined {
        return defineValue(this.url.searchParams.get(name), undefined);
    }

    public getQueryParams(): Record<string, string> {
        const params: Record<string, string> = {};

        this.url.searchParams.forEach((value: string, key: string) => {
            params[key] = value;
        });

        return params;
    }
}