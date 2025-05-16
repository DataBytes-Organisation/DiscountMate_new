export interface NutritionalInfo {
    calories: number;
    protein: string;
    fat: string;
    carbs: string;
    sugar: string;
  }
  
  export interface Product {
    id: string;
    name: string;
    category: string;
    subcategory: string;
    price: number;
    discountPrice: number | null;
    unit: string;
    image: string;
    description: string;
    nutritionalInfo: NutritionalInfo;
    stock: number;
    rating: number;
    reviews: number;
    isOrganic: boolean;
    isFeatured: boolean;
    tags: string[];
    relatedProducts: string[];
  }
  
  export interface Category {
    id: string;
    name: string;
    icon: string;
  }
  
  export interface BasketItem {
    product: Product;
    quantity: number;
  }