import { defineValue } from "@bejibun/utils";
/**
 * BunAdapter —- Implements @x402/core HTTPAdapter directly against Bun.BunRequest.
 */
export default class BunAdapter {
    request;
    url;
    constructor(request) {
        this.request = request;
        this.url = new URL(this.request.url);
    }
    getHeader(name) {
        return defineValue(this.request.headers.get(name), undefined);
    }
    getMethod() {
        return this.request.method.toUpperCase();
    }
    getPath() {
        return this.url.pathname;
    }
    getUrl() {
        return this.request.url;
    }
    getAcceptHeader() {
        return defineValue(this.request.headers.get("accept"), "");
    }
    getUserAgent() {
        return defineValue(this.request.headers.get("user-agent"), "");
    }
    getQueryParam(name) {
        return defineValue(this.url.searchParams.get(name), undefined);
    }
    getQueryParams() {
        const params = {};
        this.url.searchParams.forEach((value, key) => {
            params[key] = value;
        });
        return params;
    }
}
