// app/(product)/product/[id].tsx
import React from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import ProductHeroSection from "../../../components/product/ProductHeroSection";
import ProductSidebarQuickPanel from "../../../components/product/ProductSidebarQuickPanel";
import ProductPriceComparison from "../../../components/product/ProductPriceComparison";
import ProductPriceHistory from "../../../components/product/ProductPriceHistory";
import ProductSmartInsights from "../../../components/product/ProductSmartInsights";
import ProductSubstitutions from "../../../components/product/ProductSubstitutions";
import ProductDetails from "../../../components/product/ProductDetails";
import ProductReviews from "../../../components/product/ProductReviews";
import ProductRelatedProducts from "../../../components/product/ProductRelatedProducts";
import FooterSection from "../../../components/home/FooterSection";

export default function ProductDetailPage() {
   const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

   return (
      <View className="flex-1 bg-[#F9FAFB]">
         <View className="px-4 pt-4 pb-0 flex-row gap-4">
            {/* Main Content Area - Left */}
            <View className="flex-1">
               {/* Hero Section */}
               <ProductHeroSection productId={id} productName={name} />

               {/* Main Content Sections */}
               <View className="mt-6">
                  {/* Price Comparison */}
                  <ProductPriceComparison productId={id} />

                  {/* Price History */}
                  <ProductPriceHistory productId={id} />

                  {/* Smart Insights */}
                  <ProductSmartInsights productId={id} />

                  {/* Substitutions */}
                  <View className="mt-6">
                     <ProductSubstitutions productId={id} />
                  </View>

                  {/* Product Details */}
                  <ProductDetails productId={id} />

                  {/* Reviews */}
                  <ProductReviews productId={id} />
               </View>
            </View>

            {/* Right Sidebar */}
            <View className="w-[260px]">
               <ProductSidebarQuickPanel productId={id} />
            </View>
         </View>
         {/* Related Products - full width */}
         <ProductRelatedProducts productId={id} fullWidth />
         <FooterSection disableEdgeOffset />
      </View>
   );
}
