"""Product and price schemas used by DL-06 chatbot tools."""

from typing import List, Optional

from pydantic import BaseModel, Field


class ProductSearchArguments(BaseModel):
    product_name: str = Field(..., min_length=1)
    brand: Optional[str] = None
    pack_size: Optional[str] = None
    category: Optional[str] = None
    retailer: Optional[str] = None
    limit: int = Field(default=10, ge=1, le=25)


class ProductDetailsArguments(BaseModel):
    product_id: str = Field(..., min_length=1)


class PriceRetrievalArguments(BaseModel):
    product_id: str = Field(..., min_length=1)
    retailers: List[str] = Field(default_factory=list)


class PriceComparisonArguments(BaseModel):
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    brand: Optional[str] = None
    pack_size: Optional[str] = None
    category: Optional[str] = None
    retailers: List[str] = Field(default_factory=list)
    limit: int = Field(default=5, ge=1, le=10)


class ProductCandidate(BaseModel):
    product_id: str
    product_name: str
    brand: Optional[str] = None
    pack_size: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    score: Optional[float] = None


class ProductDetails(ProductCandidate):
    product_code: Optional[str] = None
    gtin: Optional[str] = None
    description: Optional[str] = None
    unit_per_prod: Optional[str] = None
    measurement: Optional[str] = None


class RetailerPrice(BaseModel):
    retailer: str
    price: float
    currency: str = "AUD"
    unit_price: Optional[str] = None
    is_on_special: Optional[bool] = None
    price_date: Optional[str] = None


class PriceComparisonData(BaseModel):
    action: str = "price_comparison"
    query: PriceComparisonArguments
    matched_product: Optional[ProductCandidate] = None
    candidate_products: List[ProductCandidate] = Field(default_factory=list)
    prices: List[RetailerPrice] = Field(default_factory=list)
    cheapest: Optional[RetailerPrice] = None
    status: str
    clarification_question: Optional[str] = None
