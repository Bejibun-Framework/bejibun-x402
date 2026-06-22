export type TScheme = "exact" | "upto" | "batch-settlement";

export type TFacilitator = {
    url?: string;
};

export type TRoutePaymentConfig = {
    scheme: TScheme;
    price: string;
    network?: string;
    payTo?: string;
    description?: string;
    mimeType?: string;
};