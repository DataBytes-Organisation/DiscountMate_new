import React, { useState, useEffect } from "react";
import { View, Text, Image, Pressable, ActivityIndicator } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { API_URL } from "@/constants/Api";

interface ProductHeroSectionProps {
   productId?: string;
   productName?: string;
}

type ApiProduct = {
   _id: string;
   product_id?: string | number | null;
   product_name?: string | null;
   link_image?: string | null;
   description?: string | null;
   brand?: string | null;
   product_code?: string | null;
   current_price?: number | null;
   item_price?: number | null;
   unit_price?: number | null;
   category?: string | null;
};

export default function ProductHeroSection({
   productId,
   productName,
}: ProductHeroSectionProps) {
   const [isFavorited, setIsFavorited] = useState(false);
   const [product, setProduct] = useState<ApiProduct | null>(null);
   const [loading, setLoading] = useState(true);
   const [imageError, setImageError] = useState(false);

   useEffect(() => {
      const fetchProduct = async () => {
         if (!productId) {
            setLoading(false);
            return;
         }

         try {
            setLoading(true);
            // The API endpoint is POST /api/products/getproduct with productId in body
            const response = await fetch(`${API_URL}/products/getproduct`, {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
               },
               body: JSON.stringify({ productId: productId }),
            });

            if (response.ok) {
               const data = await response.json();
               console.log("Fetched product data:", data); // Debug log
               console.log("link_image value:", data?.link_image); // Debug log
               setProduct(data);
               // Reset image error when new product is loaded
               setImageError(false);
            } else {
               const errorText = await response.text();
               console.error("Failed to fetch product:", response.status, errorText);
               console.error("ProductId used:", productId);
            }
         } catch (error) {
            console.error("Error fetching product:", error);
         } finally {
            setLoading(false);
         }
      };

      fetchProduct();
   }, [productId]);

   const displayProduct = {
      name: product?.product_name || "Product",
      subtitle: product?.description || "Product description",
      brand: product?.brand || "Unknown Brand",
      sku: product?.product_code || "N/A",
      rating: 4.5,
      reviews: 1247,
      link_image: product?.link_image || null,
      price: product?.current_price || 0,
      oldPrice: product?.item_price || product?.best_price || 0,
      retailer: "Coles",
      savings: (product?.item_price || product?.best_price) && product?.current_price
         ? (product.item_price || product.best_price) - product.current_price
         : 0,
      percent: (product?.item_price || product?.best_price) && product?.current_price
         ? Math.round((((product.item_price || product.best_price) - product.current_price) / (product.item_price || product.best_price)) * 100)
         : 0,
      trend: "down",
      size: "Standard",
      unitPrice: product?.unit_price || product?.best_unit_price || 0,
      availability: "Available for delivery & pickup",
      updated: "2 hours ago",
   };

   if (loading) {
      return (
         <View className="bg-white rounded-2xl p-6 border border-gray-200 items-center justify-center min-h-[400px]">
            <ActivityIndicator size="large" color="#10B981" />
            <Text className="text-gray-600 mt-4">Loading product...</Text>
         </View>
      );
   }

   return (
      <View className="bg-white rounded-2xl p-6 border border-gray-200">

         {/* Row: image left + info right */}
         <View className="flex-col lg:flex-row gap-6">

            {/* LEFT SIDE: Single product image */}
            <View className="lg:w-1/2">
               {displayProduct.link_image && !imageError ? (
                  <Image
                     source={{ uri: displayProduct.link_image }}
                     className="w-full h-72 rounded-2xl"
                     resizeMode="contain"
                     onError={() => setImageError(true)}
                  />
               ) : (
                  <View className="w-full h-72 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 items-center justify-center">
                     <FontAwesome6 name="image" size={48} color="#9CA3AF" />
                     <Text className="text-gray-500 mt-2">No image available</Text>
                  </View>
               )}
            </View>

            {/* RIGHT SIDE */}
            <View className="flex-1 gap-4">

               {/* Title + meta */}
               <View>
                  <View className="flex-row items-start justify-between mb-1">
                     <Text className="text-3xl font-bold text-gray-900 flex-1">
                        {displayProduct.name}
                     </Text>
                     <Pressable
                        onPress={() => setIsFavorited(!isFavorited)}
                        className="p-2"
                     >
                        <FontAwesome6
                           name="heart"
                           size={24}
                           color={isFavorited ? "#EF4444" : "#9CA3AF"}
                           solid={isFavorited}
                        />
                     </Pressable>
                  </View>

                  <Text className="text-gray-600 mt-1">{displayProduct.subtitle}</Text>

                  <Text className="text-gray-500 text-sm mt-1">
                     Brand: {displayProduct.brand} | SKU: {displayProduct.sku}
                  </Text>

                  {/* Ratings */}
                  <View className="flex-row items-center gap-2 mt-2">
                     <View className="flex-row items-center">
                        {Array.from({ length: 5 }).map((_, i) => (
                           <FontAwesome6
                              key={i}
                              name="star"
                              size={16}
                              solid
                              color={i < Math.floor(displayProduct.rating) ? "#FBBF24" : "#E5E7EB"}
                           />
                        ))}
                     </View>

                     <Text className="text-gray-600 text-sm">
                        {displayProduct.rating} ({displayProduct.reviews.toLocaleString()} reviews)
                     </Text>
                  </View>
               </View>

               {/* Best price card */}
               <View className="bg-green-100 border border-green-200 rounded-2xl p-5">
                  <Text className="text-sm text-gray-700 mb-1">
                     Best Price Available
                  </Text>

                  <View className="flex-row items-baseline gap-3">
                     <Text className="text-4xl font-bold text-gray-900">
                        ${displayProduct.price.toFixed(2)}
                     </Text>

                     {displayProduct.oldPrice > displayProduct.price && (
                        <Text className="text-gray-400 line-through text-lg">
                           ${displayProduct.oldPrice.toFixed(2)}
                        </Text>
                     )}

                     <Text className="text-gray-700 text-lg">at {displayProduct.retailer}</Text>
                  </View>

                  {displayProduct.savings > 0 && (
                     <View className="flex-row items-center gap-4 mt-2">
                        <View className="flex-row items-center gap-1">
                           <FontAwesome6 name="tag" size={14} color="#16A34A" />
                           <Text className="text-green-700 text-sm">
                              Save ${displayProduct.savings.toFixed(2)} ({displayProduct.percent}% off)
                           </Text>
                        </View>

                        <View className="flex-row items-center gap-1">
                           <FontAwesome6
                              name="arrow-trend-down"
                              size={14}
                              color="#16A34A"
                           />
                           <Text className="text-green-700 text-sm">Trending down</Text>
                        </View>
                     </View>
                  )}
               </View>

               {/* Product info rows */}
               <View className="bg-white border border-gray-200 rounded-2xl p-5 gap-4">

                  <View className="flex-row gap-2 items-center">
                     <FontAwesome6 name="box" size={16} color="#4B5563" />
                     <Text className="text-gray-700">Size: {displayProduct.size}</Text>
                  </View>

                  {displayProduct.unitPrice > 0 && (
                     <View className="flex-row gap-2 items-center">
                        <FontAwesome6 name="money-bill" size={16} color="#4B5563" />
                        <Text className="text-gray-700">
                           Unit Price: ${displayProduct.unitPrice.toFixed(2)}/unit
                        </Text>
                     </View>
                  )}

                  <View className="flex-row gap-2 items-center">
                     <FontAwesome6 name="truck" size={16} color="#4B5563" />
                     <Text className="text-gray-700">{displayProduct.availability}</Text>
                  </View>

                  <View className="flex-row gap-2 items-center">
                     <FontAwesome6 name="clock" size={16} color="#4B5563" />
                     <Text className="text-gray-700">
                        Price updated {displayProduct.updated}
                     </Text>
                  </View>
               </View>

               {/* CTA */}
               <View className="flex-row gap-3">
                  <Pressable className="flex-1 bg-primary_green py-4 rounded-xl items-center">
                     <Text className="text-white text-lg font-semibold">
                        Add to List
                     </Text>
                  </Pressable>
                  <Pressable className="px-5 py-4 border-2 border-gray-200 rounded-xl items-center justify-center">
                     <FontAwesome6 name="share-nodes" size={20} color="#4B5563" />
                  </Pressable>
               </View>

            </View>
         </View>

      </View>
   );
}
