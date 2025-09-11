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
  discountPrice: number; 
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

  productCode?: string;
  bestPrice?: number | null;
  bestUnitPrice?: number | null;
  itemPrice?: number | null;
  unitPrice?: number | null;
  originalPrice?: number | null;
}
