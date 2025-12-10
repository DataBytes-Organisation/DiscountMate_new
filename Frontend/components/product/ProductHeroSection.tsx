import React, { useState } from "react";
import { View, Text, Image, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function ProductHeroSection() {
   const [selected, setSelected] = useState(0);
   const [isFavorited, setIsFavorited] = useState(false);

   const product = {
      name: "Milk Full Cream 2L",
      subtitle: "Fresh dairy milk",
      brand: "Dairy Valley",
      sku: "DV-MILK-2L",
      rating: 4.5,
      reviews: 1247,
      images: [
         "https://images.pexels.com/photos/3738096/pexels-photo-3738096.jpeg",
         "https://images.pexels.com/photos/4109993/pexels-photo-4109993.jpeg",
         "https://images.pexels.com/photos/4457151/pexels-photo-4457151.jpeg",
         "https://images.pexels.com/photos/4109992/pexels-photo-4109992.jpeg",
      ],
      price: 3.5,
      oldPrice: 4.7,
      retailer: "Aldi",
      savings: 1.2,
      percent: 25,
      trend: "down",
      size: "2 Liters",
      unitPrice: 1.75,
      availability: "Available for delivery & pickup",
      updated: "2 hours ago",
   };

   return (
      <View className="bg-white rounded-2xl p-6 border border-gray-200">

         {/* Row: image left + info right */}
         <View className="flex-col lg:flex-row gap-6">

            {/* LEFT SIDE: Main image + thumbnails */}
            <View className="lg:w-1/2">
               <Image
                  source={{ uri: product.images[selected] }}
                  className="w-full h-72 rounded-2xl"
               />

               <View className="flex-row gap-3 mt-4">
                  {product.images.map((img, i) => (
                     <Pressable
                        key={i}
                        onPress={() => setSelected(i)}
                        className={[
                           "w-16 h-16 rounded-xl overflow-hidden border",
                           selected === i
                              ? "border-primary_green"
                              : "border-gray-200",
                        ].join(" ")}
                     >
                        <Image
                           source={{ uri: img }}
                           className="w-full h-full"
                           resizeMode="cover"
                        />
                     </Pressable>
                  ))}
               </View>
            </View>

            {/* RIGHT SIDE */}
            <View className="flex-1 gap-4">

               {/* Title + meta */}
               <View>
                  <View className="flex-row items-start justify-between mb-1">
                     <Text className="text-3xl font-bold text-gray-900 flex-1">
                        {product.name}
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

                  <Text className="text-gray-600 mt-1">{product.subtitle}</Text>

                  <Text className="text-gray-500 text-sm mt-1">
                     Brand: {product.brand} | SKU: {product.sku}
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
                              color={i < Math.floor(product.rating) ? "#FBBF24" : "#E5E7EB"}
                           />
                        ))}
                     </View>

                     <Text className="text-gray-600 text-sm">
                        {product.rating} ({product.reviews.toLocaleString()} reviews)
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
                        ${product.price.toFixed(2)}
                     </Text>

                     <Text className="text-gray-400 line-through text-lg">
                        ${product.oldPrice.toFixed(2)}
                     </Text>

                     <Text className="text-gray-700 text-lg">at {product.retailer}</Text>
                  </View>

                  <View className="flex-row items-center gap-4 mt-2">
                     <View className="flex-row items-center gap-1">
                        <FontAwesome6 name="tag" size={14} color="#16A34A" />
                        <Text className="text-green-700 text-sm">
                           Save ${product.savings.toFixed(2)} ({product.percent}% off)
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
               </View>

               {/* Product info rows */}
               <View className="bg-white border border-gray-200 rounded-2xl p-5 gap-4">

                  <View className="flex-row gap-2 items-center">
                     <FontAwesome6 name="box" size={16} color="#4B5563" />
                     <Text className="text-gray-700">Size: {product.size}</Text>
                  </View>

                  <View className="flex-row gap-2 items-center">
                     <FontAwesome6 name="money-bill" size={16} color="#4B5563" />
                     <Text className="text-gray-700">
                        Unit Price: ${product.unitPrice}/L
                     </Text>
                  </View>

                  <View className="flex-row gap-2 items-center">
                     <FontAwesome6 name="truck" size={16} color="#4B5563" />
                     <Text className="text-gray-700">{product.availability}</Text>
                  </View>

                  <View className="flex-row gap-2 items-center">
                     <FontAwesome6 name="clock" size={16} color="#4B5563" />
                     <Text className="text-gray-700">
                        Price updated {product.updated}
                     </Text>
                  </View>
               </View>

               {/* CTA */}
               <View className="flex-row gap-3">
                  <Pressable className="flex-1 bg-primary_green py-4 rounded-xl items-center">
                     <Text className="text-white text-lg font-semibold">
                        Add to Basket
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
