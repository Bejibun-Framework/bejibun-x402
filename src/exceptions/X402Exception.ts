import Logger from "@bejibun/logger";
import {defineValue} from "@bejibun/utils";

export default class X402Exception extends Error {
    public code: number;
    public data?: any;

    public constructor(message?: string, data?: any, code?: number) {
        super(message);
        this.name = "X402Exception";
        this.code = defineValue(code, 412);
        this.data = defineValue(data);

        Logger.setContext(this.name).error(this.message).trace(this.stack);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, X402Exception);
        }
    }
}