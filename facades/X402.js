import X402Builder from "../builders/X402Builder";
export default class X402 {
    static setFacilitator(config) {
        return new X402Builder().setFacilitator(config);
    }
    static setRoutePayment(config) {
        return new X402Builder().setRoutePayment(config);
    }
    static setRequest(request) {
        return new X402Builder().setRequest(request);
    }
}
