export type CatalogueSource = "mongo" | "postgres";

export type CatalogueCategory = {
    id: string;
    name: string;
    description?: string | null;
    iconUrl?: string | null;
    displayOrder?: number | null;
    productCount?: number;
};

export type CatalogueProductDetail = {
    _id: string;
    product_name?: string | null;
    product_code?: string | null;
    link_image?: string | null;
    image_link_back?: string | null;
    image_link_side?: string | null;
    description?: string | null;
    brand?: string | null;
    current_price?: number | null;
    unit_price?: string | null;
    is_on_special?: boolean | null;
    price_date?: string | null;
    unit_per_prod?: number | null;
    measurement?: string | null;
    gtin?: string | null;
    retailer_name?: string | null;
};