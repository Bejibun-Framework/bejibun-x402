import type { TX402Config, TFacilitator, TPaywall, TRoutePaymentConfig } from "@/builders/X402Builder";
import X402Builder from "@/builders/X402Builder";

export type { TX402Config, TFacilitator, TPaywall, TRoutePaymentConfig };

export default class X402 {
    public static setConfig(config?: TX402Config): X402Builder {
        return new X402Builder().setConfig(config);
    }

    public static setFacilitator(config?: TFacilitator): X402Builder {
        return new X402Builder().setFacilitator(config);
    }

    public static setPaywall(config?: TPaywall): X402Builder {
        return new X402Builder().setPaywall(config);
    }

    public static setRoute(config: TRoutePaymentConfig): X402Builder {
        return new X402Builder().setRoute(config);
    }

    public static setRequest(request: Bun.BunRequest): X402Builder {
        return new X402Builder().setRequest(request);
    }
}
