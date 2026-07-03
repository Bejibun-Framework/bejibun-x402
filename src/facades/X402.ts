import type {TFacilitator, TRoutePayment} from "@/types/x402";
import X402Builder from "@/builders/X402Builder";

export default class X402 {
    public static setFacilitator(config?: TFacilitator): X402Builder {
        return new X402Builder().setFacilitator(config);
    }

    public static setRoutePayment(config?: TRoutePayment): X402Builder {
        return new X402Builder().setRoutePayment(config);
    }

    public static setRequest(request: Bun.BunRequest): X402Builder {
        return new X402Builder().setRequest(request);
    }
}
