import type { TFacilitator, TRoutePayment } from "../types/x402";
import X402Builder from "../builders/X402Builder";
export default class X402 {
    static setFacilitator(config?: TFacilitator): X402Builder;
    static setRoutePayment(config?: TRoutePayment): X402Builder;
    static setRequest(request: Bun.BunRequest): X402Builder;
}
