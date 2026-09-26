import React from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import ProductHeroSection from "../../../components/product/ProductHeroSection";
import ProductSidebarQuickPanel from "../../../components/product/ProductSidebarQuickPanel";
import ProductPriceComparison from "../../../components/product/ProductPriceComparison";
import ProductPriceHistory from "../../../components/product/ProductPriceHistory";
import ProductSmartInsights from "../../../components/product/ProductSmartInsights";
import ProductSubstitutions from "../../../components/product/ProductSubstitutions";
import ProductRelatedProducts from "../../../components/product/ProductRelatedProducts";
import FooterSection from "../../../components/home/FooterSection";
import type {CatalogueSource} from "@/services/catalogue/types";

export default function ProductDetailPage() {
   const { id, source } = useLocalSearchParams<{
      id: string | string[];
      source?: string | string[];
   }>();
   const rawSource = Array.isArray(source)
      ? source[0]
      : source;
   const catalogueSource: CatalogueSource =
      rawSource === "postgres"
         ? "postgres"
         : "mongo";

   return (
      <View className="flex-1 bg-[#F9FAFB]">
         <View className="px-4 pt-4 pb-0 flex-row gap-4">
            <View className="flex-1">
               <ProductHeroSection
                  productId={id}
                  source={catalogueSource}
               />
               <View className="mt-6">
                  <ProductPriceComparison
                     productId={id}/>

                  <ProductPriceHistory
                     productId={id}
                  />

                  <ProductSmartInsights
                     productId={id}
                  />

                  <View className="mt-6">
                     <ProductSubstitutions
                        productId={id}
                     />
                  </View>
               </View>
            </View>

            <View className="w-[260px]">
               <ProductSidebarQuickPanel
                  productId={id}
               />
            </View>
         </View>

         <ProductRelatedProducts
            productId={id}
            fullWidth
         />

         <FooterSection disableEdgeOffset />
      </View>
   );
}