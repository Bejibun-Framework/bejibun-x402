import type { HTTPAdapter } from "@x402/core/http";
/**
 * BunAdapter —- Implements @x402/core HTTPAdapter directly against Bun.BunRequest.
 */
export default class BunAdapter implements HTTPAdapter {
    private readonly request;
    private readonly url;
    constructor(request: Bun.BunRequest);
    getHeader(name: string): string | undefined;
    getMethod(): string;
    getPath(): string;
    getUrl(): string;
    getAcceptHeader(): string;
    getUserAgent(): string;
    getQueryParam(name: string): string | undefined;
    getQueryParams(): Record<string, string>;
}
