import X402Builder from "../builders/X402Builder";
export default class X402 {
    static setConfig(config) {
        return new X402Builder().setConfig(config);
    }
    static setFacilitator(config) {
        return new X402Builder().setFacilitator(config);
    }
    static setPaywall(config) {
        return new X402Builder().setPaywall(config);
    }
    static setRoute(config) {
        return new X402Builder().setRoute(config);
    }
    static setRequest(request) {
        return new X402Builder().setRequest(request);
    }
}
