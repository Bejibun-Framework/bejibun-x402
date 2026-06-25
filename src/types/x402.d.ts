export type TScheme = "exact" | "upto" | "batch-settlement";

export type TFacilitator = {
    url?: string;
};

export type Network = `${string}:${string}`;

export type TNetworkPaymentConfig = {
    scheme?: TScheme;
    price?: string;
    network: Network;
    payTo: string;
    description?: string;
    mimeType?: string;
};

export type TRoutePaymentConfig = {
    scheme?: TScheme;
    price?: string;
    network: Network;
    payTo?: string;
    description?: string;
    mimeType?: string;
    accepts?: TNetworkPaymentConfig[];
};