import React from "react";
import { View, Text, Pressable, Image, ScrollView } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useRouter } from "expo-router";

interface RelatedProduct {
   id: string;
   name: string;
   price: number;
   oldPrice: number;
   savings: number;
   retailer: string;
   image: string;
}

interface ProductRelatedProductsProps {
   productId?: string | string[];
   fullWidth?: boolean;
}

export default function ProductRelatedProducts({
   productId,
   fullWidth = false,
}: ProductRelatedProductsProps) {
   const router = useRouter();

   // Mock data matching the design
   const relatedProducts: RelatedProduct[] = [
      {
         id: "1",
         name: "Skim Milk 2L",
         price: 3.2,
         oldPrice: 4.3,
         savings: 1.1,
         retailer: "Aldi",
         image:
            "https://images.pexels.com/photos/3738088/pexels-photo-3738088.jpeg",
      },
      {
         id: "2",
         name: "Yogurt Natural 1kg",
         price: 4.5,
         oldPrice: 6.0,
         savings: 1.5,
         retailer: "Coles",
         image:
            "https://images.pexels.com/photos/699954/pexels-photo-699954.jpeg",
      },
      {
         id: "3",
         name: "Butter 500g",
         price: 5.0,
         oldPrice: 7.0,
         savings: 2.0,
         retailer: "Woolworths",
         image:
            "https://images.pexels.com/photos/3738023/pexels-photo-3738023.jpeg",
      },
      {
         id: "4",
         name: "Cream 600ml",
         price: 4.2,
         oldPrice: 5.0,
         savings: 0.8,
         retailer: "Aldi",
         image:
            "https://images.pexels.com/photos/5665665/pexels-photo-5665665.jpeg",
      },
      {
         id: "5",
         name: "Free Range Eggs 12 Pack",
         price: 5.6,
         oldPrice: 6.5,
         savings: 0.9,
         retailer: "Coles",
         image:
            "https://images.pexels.com/photos/162712/egg-white-food-protein-162712.jpeg",
      },
      {
         id: "6",
         name: "Sourdough Loaf 750g",
         price: 4.8,
         oldPrice: 5.9,
         savings: 1.1,
         retailer: "Woolworths",
         image:
            "https://images.pexels.com/photos/2434/bread-food-healthy-breakfast.jpg",
      },
      {
         id: "7",
         name: "Organic Bananas 1kg",
         price: 3.9,
         oldPrice: 4.7,
         savings: 0.8,
         retailer: "Aldi",
         image:
            "https://images.pexels.com/photos/461208/pexels-photo-461208.jpeg",
      },
      {
         id: "8",
         name: "Cheddar Cheese Block 500g",
         price: 6.5,
         oldPrice: 7.8,
         savings: 1.3,
         retailer: "Coles",
         image:
            "https://images.pexels.com/photos/884600/pexels-photo-884600.jpeg",
      },
      {
         id: "9",
         name: "Olive Oil Extra Virgin 1L",
         price: 9.9,
         oldPrice: 12.0,
         savings: 2.1,
         retailer: "Woolworths",
         image:
            "https://images.pexels.com/photos/534028/pexels-photo-534028.jpeg",
      },
      {
         id: "10",
         name: "Penne Pasta 1kg",
         price: 2.7,
         oldPrice: 3.4,
         savings: 0.7,
         retailer: "Aldi",
         image:
            "https://images.pexels.com/photos/1437267/pexels-photo-1437267.jpeg",
      },
   ];

   return (
      <View
         className={[
            "bg-white border border-gray-200 p-6",
            fullWidth ? "rounded-none mb-0" : "rounded-2xl mb-10",
         ].join(" ")}
         style={fullWidth ? { marginHorizontal: -16 } : undefined}
      >
         {/* Header */}
         <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-gray-900">
               Customers Also Viewed
            </Text>
            <Pressable className="flex-row items-center gap-1">
               <Text className="text-sm font-semibold text-primary_green">
                  View All
               </Text>
               <FontAwesome6
                  name="arrow-right-long"
                  size={12}
                  color="#10B981"
               />
            </Pressable>
         </View>

         {/* Horizontal list of cards */}
         <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8 }}
         >
            {relatedProducts.map((product, index) => (
               <Pressable
                  key={product.id}
                  onPress={() => router.push(`/product/${product.id}`)}
                  className={[
                     "w-64 mr-4 bg-white border border-gray-200 rounded-2xl overflow-hidden",
                     index === 0 ? "ml-1" : "",
                  ].join(" ")}
               >
                  {/* Image */}
                  <View className="w-full h-32 bg-gray-100">
                     <Image
                        source={{ uri: product.image }}
                        className="w-full h-full"
                        resizeMode="cover"
                     />
                  </View>

                  {/* Content */}
                  <View className="p-4">
                     <Text
                        className="text-sm font-semibold text-gray-900 mb-2"
                        numberOfLines={2}
                     >
                        {product.name}
                     </Text>

                     {/* Savings pill */}
                     <View className="mb-2">
                        <View className="self-start px-3 py-1 rounded-full bg-primary_green/10">
                           <Text className="text-xs font-semibold text-primary_green">
                              Save ${product.savings.toFixed(2)}
                           </Text>
                        </View>
                     </View>

                     {/* Price row */}
                     <View className="flex-row items-baseline justify-between mb-1">
                        <Text className="text-xl font-bold text-primary_green">
                           ${product.price.toFixed(2)}
                        </Text>
                        <Text className="text-xs text-gray-500">
                           at {product.retailer}
                        </Text>
                     </View>
                     <Text className="text-xs text-gray-400 line-through mb-3">
                        ${product.oldPrice.toFixed(2)}
                     </Text>

                     {/* CTA */}
                     <Pressable className="bg-primary_green rounded-xl py-2.5 items-center">
                        <Text className="text-sm font-semibold text-white">
                           View Details
                        </Text>
                     </Pressable>
                  </View>
               </Pressable>
            ))}
         </ScrollView>
      </View>
   );
}
