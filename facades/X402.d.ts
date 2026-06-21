import type { TX402Config, TFacilitator, TPaywall, TRoutePaymentConfig } from "../builders/X402Builder";
import X402Builder from "../builders/X402Builder";
export type { TX402Config, TFacilitator, TPaywall, TRoutePaymentConfig };
export default class X402 {
    static setConfig(config?: TX402Config): X402Builder;
    static setFacilitator(config?: TFacilitator): X402Builder;
    static setPaywall(config?: TPaywall): X402Builder;
    static setRoute(config: TRoutePaymentConfig): X402Builder;
    static setRequest(request: Bun.BunRequest): X402Builder;
}
