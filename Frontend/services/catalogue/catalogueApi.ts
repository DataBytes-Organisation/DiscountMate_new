import { API_URL } from "@/constants/Api";
import type { ApiProduct } from "@/components/home/ProductGrid";
import type {CatalogueCategory, CatalogueProductDetail, CatalogueSource,} from "./types";

type PostgresCategory = {
    id: string;
    name: string;
    description?: string | null;
    iconUrl?: string | null;
    displayOrder?: number | null;
    productCount?: number;
};

type PostgresRetailerPrice = {
    retailer: {
        id: string;
        name: string;
        websiteUrl?: string | null;
    };
    price: number | null;
    unitPrice: number | null;
    unitPriceLabel: string | null;
    available: boolean;
    isOnSpecial: boolean;
    specialText: string | null;
    productUrl: string | null;
    recordedAt: string | null;
};

type PostgresProduct = {
    id: string;
    name: string;
    brand?: string | null;
    description?: string | null;
    category?: { id: string | null; name: string | null;} | null;
    pack?: {quantity: number | null; unit: string | null; } | null;
    gtin?: string | null;
    images?: {primary: string | null; side: string | null; back: string | null;} | null;
    currentPrice?: number | null;
    prices?: PostgresRetailerPrice[];
    isOnSpecial?: boolean;
};

type PostgresProductsResponse = {
    items?: PostgresProduct[];
    pagination?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
    };
};

function getRetailerKey(
    name: string
): "coles" | "woolworths" | "iga" | "aldi" | null {
    const value = name.trim().toLowerCase();
    if (value.includes("woolworth")) return "woolworths";
    if (value.includes("coles")) return "coles";
    if (value.includes("aldi")) return "aldi";
    if (value.includes("iga")) return "iga";
    return null;
}

function positiveNumber(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return null;
    }
    return value;
}

function mapPostgresProductToGridProduct(
    product: PostgresProduct
): ApiProduct {
    const mapped: ApiProduct = {
        _id: product.id,
        product_name: product.name,
        product_code: product.gtin ?? product.id,
        brand: product.brand ?? null,
        gtin: product.gtin ?? null,
        unit_per_prod: product.pack?.quantity ?? null,
        measurement: product.pack?.unit?.trim() || null,
        category_id: product.category?.id ?? null,
        category_name: product.category?.name ?? null,
        description: product.description ?? null,
        link_image: product.images?.primary ?? null,
        current_price: positiveNumber(product.currentPrice),
        unit_price: null,
        store_chain: null,
        catalogue_source: "postgres",
        is_on_special: product.isOnSpecial === true,
        special_text: null,
        coles_price: null,
        coles_unit_price: null,
        woolworths_price: null,
        woolworths_unit_price: null,
        iga_price: null,
        iga_unit_price: null,
        aldi_price: null,
        aldi_unit_price: null,
    };

    const prices = Array.isArray(product.prices) ? product.prices : [];

    for (const offer of prices) {
        const storeKey = getRetailerKey(offer.retailer?.name || "");
        if (!storeKey) continue;

        const price = positiveNumber(offer.price);
        const unitPriceLabel = offer.unitPriceLabel?.trim() || null;

        if (storeKey === "coles") {
            mapped.coles_price = price;
            mapped.coles_unit_price = unitPriceLabel;
        }

        if (storeKey === "woolworths") {
            mapped.woolworths_price = price;
            mapped.woolworths_unit_price = unitPriceLabel;
        }

        if (storeKey === "iga") {
            mapped.iga_price = price;
            mapped.iga_unit_price = unitPriceLabel;
        }

        if (storeKey === "aldi") {
            mapped.aldi_price = price;
            mapped.aldi_unit_price = unitPriceLabel;
        }
    }

    const cheapestOffer = prices
        .filter(
            (
                offer
            ): offer is PostgresRetailerPrice & { price: number } =>
                positiveNumber(offer.price) !== null
        )
        .sort((left, right) => left.price - right.price)[0];

    if (cheapestOffer) {
        mapped.current_price = cheapestOffer.price;
        mapped.unit_price =
            cheapestOffer.unitPriceLabel?.trim() || null;
        mapped.store_chain = getRetailerKey(
            cheapestOffer.retailer?.name || ""
        );

        if (cheapestOffer.specialText?.trim()) {
            mapped.special_text = cheapestOffer.specialText.trim();
        }
    }
    
    if (!mapped.special_text) {
        const specialOffer = prices.find(
            (offer) => offer.isOnSpecial && offer.specialText?.trim()
        );
        mapped.special_text =
            specialOffer?.specialText?.trim() || null;
    }
    return mapped;
}

function mapPostgresProductToDetail(
    product: PostgresProduct
): CatalogueProductDetail {
    const prices = Array.isArray(product.prices) ? product.prices : [];

    const cheapestOffer = prices
        .filter(
            (
                offer
            ): offer is PostgresRetailerPrice & { price: number } =>
                positiveNumber(offer.price) !== null
        )
        .sort((left, right) => left.price - right.price)[0];

    return {
        _id: product.id,
        product_name: product.name,
        product_code: product.gtin ?? product.id,
        link_image: product.images?.primary ?? null,
        image_link_back: product.images?.back ?? null,
        image_link_side: product.images?.side ?? null,
        description: product.description ?? null,
        brand: product.brand ?? null,
        current_price:
            cheapestOffer?.price ??
            positiveNumber(product.currentPrice),
        unit_price:
            cheapestOffer?.unitPriceLabel?.trim() || null,
        is_on_special:
            product.isOnSpecial === true ||
            cheapestOffer?.isOnSpecial === true,
        price_date: cheapestOffer?.recordedAt ?? null,
        unit_per_prod: product.pack?.quantity ?? null,
        measurement: product.pack?.unit?.trim() || null,
        gtin: product.gtin ?? null,
        retailer_name:
            cheapestOffer?.retailer?.name ?? null,
    };
}

export async function fetchCatalogueCategories(
    source: CatalogueSource,
    signal?: AbortSignal
): Promise<CatalogueCategory[]> {
    const endpoint =
        source === "postgres"
            ? `${API_URL}/postgres/categories`
            : `${API_URL}/categories`;

    const response = await fetch(endpoint, { signal });

    if (!response.ok) {
        throw new Error(
            `Categories request failed: ${response.status}`
        );
    }

    const data = await response.json();

    if (source === "postgres") {
        const items = Array.isArray(data?.items)
            ? (data.items as PostgresCategory[])
            : [];

        return items.map((category) => ({
            id: String(category.id),
            name: category.name,
            description: category.description ?? null,
            iconUrl: category.iconUrl ?? null,
            displayOrder: category.displayOrder ?? null,
            productCount: category.productCount ?? 0,
        }));
    }

    if (!Array.isArray(data)) {
        throw new Error("Unexpected Mongo categories response");
    }

    return data
        .filter(
            (category) =>
                category?._id && category?.category_name
        )
        .map((category) => ({
            id: String(category._id),
            name: String(category.category_name),
            description: category.description ?? null,
            iconUrl: category.icon_url ?? null,
            displayOrder: category.display_order ?? null,
        }));
}

export async function fetchPostgresProductsPage(
    page: number,
    pageSize: number,
    categoryId?: string,
    search?: string,
    signal?: AbortSignal
): Promise<{
    items: ApiProduct[];
    total: number;
    totalPages: number;
}> {
    const params = new URLSearchParams();

    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    if (categoryId && categoryId !== "All") {
        params.set("categoryId", categoryId);
    }

    if (search?.trim()) {
        params.set("search", search.trim());
    }

    const response = await fetch(
        `${API_URL}/postgres/products?${params.toString()}`,
        { signal }
    );

    if (!response.ok) {
        throw new Error(
            `PostgreSQL products request failed: ${response.status}`
        );
    }

    const data =
        (await response.json()) as PostgresProductsResponse;

    const rawItems = Array.isArray(data.items)
        ? data.items
        : [];

    const items = rawItems.map(
        mapPostgresProductToGridProduct
    );

    const total =
        typeof data.pagination?.total === "number"
            ? data.pagination.total
            : items.length;

    const totalPages =
        typeof data.pagination?.totalPages === "number"
            ? data.pagination.totalPages
            : Math.ceil(total / Math.max(1, pageSize));

    return {
        items,
        total,
        totalPages,
    };
}

export async function fetchCatalogueProductDetail(
    source: CatalogueSource,
    productId: string,
    signal?: AbortSignal
): Promise<CatalogueProductDetail> {
    const endpoint =
        source === "postgres"
            ? `${API_URL}/postgres/products/${encodeURIComponent(
                productId
            )}`
            : `${API_URL}/products/${encodeURIComponent(productId)}`;

    const response = await fetch(endpoint, { signal });

    if (!response.ok) {
        throw new Error(
            `Product request failed: ${response.status}`
        );
    }

    const data = await response.json();

    if (source === "postgres") {
        return mapPostgresProductToDetail(
            data as PostgresProduct
        );
    }

    return data as CatalogueProductDetail;
}