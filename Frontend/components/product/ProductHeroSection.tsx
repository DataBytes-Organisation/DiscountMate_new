import React, { useMemo, useState, useEffect } from "react";
import { View, Text, Image, Pressable, ActivityIndicator } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { API_URL } from "@/constants/Api";

interface ProductHeroSectionProps {
   productId?: string | string[];
   productName?: string;
}

type ApiProduct = {
   _id: string;
   product_name?: string | null;
   product_code?: string | null;
   link_image?: string | null;
   image_link_back?: string | null;
   image_link_side?: string | null;
   description?: string | null;
   brand?: string | null;
   current_price?: number | null;
   best_price?: number | null;
   unit_price?: string | null;
   best_unit_price?: string | null;
   is_on_special?: boolean | null;
   price_date?: string | null;
   unit_per_prod?: number | null;
   measurement?: string | null;
   gtin?: string | null;
};

export default function ProductHeroSection({
   productId,
}: ProductHeroSectionProps) {
   const [isFavorited, setIsFavorited] = useState(false);
   const [product, setProduct] = useState<ApiProduct | null>(null);
   const [loading, setLoading] = useState(true);
   const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
   const [erroredImageUris, setErroredImageUris] = useState<Record<string, true>>({});

   const resolvedProductId = Array.isArray(productId) ? productId[0] : productId;

   const galleryImages = useMemo<
      Array<{ key: "front" | "back" | "side"; label: string; uri: string }>
   >(() => {
      const candidates: Array<{
         key: "front" | "back" | "side";
         label: string;
         uri: string | null | undefined;
      }> = [
         { key: "front", label: "Front", uri: product?.link_image },
         { key: "back", label: "Back", uri: product?.image_link_back },
         { key: "side", label: "Side", uri: product?.image_link_side },
      ];

      const seen = new Set<string>();
      const out: Array<{ key: "front" | "back" | "side"; label: string; uri: string }> = [];

      for (const img of candidates) {
         if (!img.uri) continue;
         if (seen.has(img.uri)) continue;
         seen.add(img.uri);
         out.push({ key: img.key, label: img.label, uri: img.uri });
      }

      return out;
   }, [product?.link_image, product?.image_link_back, product?.image_link_side]);

   const mainImageUri = selectedImageUri ?? galleryImages[0]?.uri ?? null;

   useEffect(() => {
      const fetchProduct = async () => {
         if (!resolvedProductId) {
            setLoading(false);
            return;
         }

         try {
            setLoading(true);
            // Backend route is GET /api/products/:id
            const response = await fetch(
               `${API_URL}/products/${encodeURIComponent(resolvedProductId)}`
            );

            if (response.ok) {
               const data = await response.json();
               setProduct(data);
               // Reset gallery state when new product is loaded
               const defaultUri =
                  data?.link_image || data?.image_link_back || data?.image_link_side || null;
               setSelectedImageUri(defaultUri);
               setErroredImageUris({});
            } else {
               const errorText = await response.text();
               console.error("Failed to fetch product:", response.status, errorText);
               console.error("ProductId used:", resolvedProductId);
            }
         } catch (error) {
            console.error("Error fetching product:", error);
         } finally {
            setLoading(false);
         }
      };

      fetchProduct();
   }, [resolvedProductId]);

   const currentPrice = typeof product?.current_price === "number" ? product.current_price : 0;
   const oldPrice = typeof product?.best_price === "number" ? product.best_price : 0;
   const savings = oldPrice > 0 && currentPrice > 0 ? oldPrice - currentPrice : 0;
   const percent =
      oldPrice > 0 && currentPrice > 0
         ? Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
         : 0;

   const displayProduct = {
      name: product?.product_name || "Product",
      subtitle: product?.description || "Product description",
      brand: product?.brand || "Unknown Brand",
      sku: product?.product_code || "N/A",
      rating: 4.5,
      reviews: 1247,
      link_image: product?.link_image || null,
      image_link_back: product?.image_link_back || null,
      image_link_side: product?.image_link_side || null,
      price: currentPrice,
      oldPrice,
      retailer: "Coles",
      savings,
      percent,
      trend: "down",
      size:
         product?.unit_per_prod && product?.measurement
            ? `${product.unit_per_prod}${product.measurement}`
            : "Standard",
      unitPriceLabel: product?.unit_price || product?.best_unit_price || null,
      availability: "Available for delivery & pickup",
      updated: product?.price_date ? String(product.price_date) : "recently",
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

            {/* LEFT SIDE: Image gallery */}
            <View className="lg:w-1/2">
               {mainImageUri && !erroredImageUris[mainImageUri] ? (
                  <Image
                     source={{ uri: mainImageUri }}
                     className="w-full h-72 rounded-2xl"
                     resizeMode="contain"
                     onError={() => {
                        if (!mainImageUri) return;
                        setErroredImageUris((prev) => ({ ...prev, [mainImageUri]: true }));
                        const nextUri = galleryImages.find(
                           (img) => img.uri !== mainImageUri && !erroredImageUris[img.uri]
                        )?.uri;
                        if (nextUri) setSelectedImageUri(nextUri);
                     }}
                  />
               ) : (
                  <View className="w-full h-72 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 items-center justify-center">
                     <FontAwesome6 name="image" size={48} color="#9CA3AF" />
                     <Text className="text-gray-500 mt-2">No image available</Text>
                  </View>
               )}

               {galleryImages.length > 1 && (
                  <View className="flex-row gap-3 mt-4">
                     {galleryImages.map((img) => {
                        const isSelected = img.uri === mainImageUri;
                        const isErrored = !!erroredImageUris[img.uri];

                        return (
                           <Pressable
                              key={img.key}
                              onPress={() => setSelectedImageUri(img.uri)}
                              className={[
                                 "w-16 h-16 rounded-xl border overflow-hidden items-center justify-center",
                                 isSelected ? "border-primary_green" : "border-gray-200",
                                 isErrored ? "bg-gray-100" : "bg-white",
                              ].join(" ")}
                           >
                              {isErrored ? (
                                 <FontAwesome6 name="image" size={18} color="#9CA3AF" />
                              ) : (
                                 <Image
                                    source={{ uri: img.uri }}
                                    className="w-full h-full"
                                    resizeMode="contain"
                                    onError={() =>
                                       setErroredImageUris((prev) => ({
                                          ...prev,
                                          [img.uri]: true,
                                       }))
                                    }
                                 />
                              )}
                           </Pressable>
                        );
                     })}
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

                  {!!displayProduct.unitPriceLabel && (
                     <View className="flex-row gap-2 items-center">
                        <FontAwesome6 name="money-bill" size={16} color="#4B5563" />
                        <Text className="text-gray-700">
                           Unit Price: {displayProduct.unitPriceLabel}
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
