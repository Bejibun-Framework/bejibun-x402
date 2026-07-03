export type TAssetAmount = {
    asset: string;
    amount: string;
    extra?: Record<string, unknown>;
};

export type TFacilitator = {
    url?: string;
    createAuthHeaders?: () => Promise<{
        verify: Record<string, string>;
        settle: Record<string, string>;
        supported: Record<string, string>;
        bazaar?: Record<string, string>;
    }>;
};

export type TNetwork = `${string}:${string}`;

export type TMoney = string | number;

export type TPrice = TAssetAmount | TMoney;

export type TScheme = "exact" | "upto" | "batch-settlement";

export type TNetworkPayment = {
    scheme?: TScheme;
    price?: TPrice;
    network: TNetwork;
    payTo: string;
    description?: string;
    mimeType?: string;
};

export type TRoutePayment = {
    scheme?: TScheme;
    price?: TPrice;
    network: TNetwork;
    payTo?: string;
    description?: string;
    mimeType?: string;
    accepts?: Array<TNetworkPayment>;
};