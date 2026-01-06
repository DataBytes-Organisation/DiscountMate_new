import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

type SubItem = {
   id: string;
   insteadOf: { name: string; price: number; icon: string };
   tryThis: { name: string; price: number; icon: string };
};

export default function SmartSubstitutionsSection() {
   const substitutions: SubItem[] = [
      {
         id: "1",
         insteadOf: { name: "Premium Coffee Beans 1kg", price: 21.5, icon: "mug-hot" },
         tryThis: { name: "House Brand Coffee Beans 1kg", price: 16.9, icon: "mug-hot" },
      },
      {
         id: "2",
         insteadOf: { name: "Brand Cheddar 500g", price: 6.8, icon: "cheese" },
         tryThis: { name: "Store Brand Cheddar 500g", price: 5.2, icon: "cheese" },
      },
      {
         id: "3",
         insteadOf: { name: "Premium Orange Juice 2L", price: 5.2, icon: "glass-water" },
         tryThis: { name: "Value Orange Juice 2L", price: 3.8, icon: "glass-water" },
      },
   ];

   const totalSavings = useMemo(() => {
      const sum = substitutions.reduce((acc, s) => acc + (s.insteadOf.price - s.tryThis.price), 0);
      return sum;
   }, []);

   return (
      <View className="px-4 md:px-8 py-10 bg-[#F9FAFB]">
         <View className="w-full">
            {/* Header */}
            <View className="mb-8">
               <Text className="text-3xl font-bold text-gray-900 mb-2">Smart Substitutions</Text>
               <Text className="text-base text-gray-600">Similar products that could save you more</Text>
            </View>

            {/* Cards */}
            <View className="flex-row flex-wrap gap-6">
               {substitutions.map((s) => {
                  const savings = s.insteadOf.price - s.tryThis.price;

                  return (
                     <View
                        key={s.id}
                        className="flex-1 min-w-[320px] bg-white rounded-3xl border border-gray-200 shadow-sm p-6"
                     >
                        {/* Instead of */}
                        <Text className="text-sm font-semibold text-gray-600 mb-3">Instead of:</Text>
                        <MiniProductCard
                           icon={s.insteadOf.icon}
                           name={s.insteadOf.name}
                           price={s.insteadOf.price}
                           variant="neutral"
                        />

                        {/* Try this */}
                        <Text className="text-sm font-semibold text-gray-600 mt-6 mb-3">Try this:</Text>
                        <MiniProductCard
                           icon={s.tryThis.icon}
                           name={s.tryThis.name}
                           price={s.tryThis.price}
                           variant="highlight"
                        />

                        <View className="h-px bg-gray-200 my-6" />

                        {/* You save row */}
                        <View className="flex-row items-center justify-between mb-5">
                           <Text className="text-sm font-semibold text-gray-700">You save:</Text>
                           <Text className="text-3xl font-bold text-primary_green">
                              ${savings.toFixed(2)}
                           </Text>
                        </View>

                        {/* CTA */}
                        <Pressable className="w-full rounded-2xl bg-primary_green py-4 shadow-sm">
                           <Text className="text-white text-center font-semibold">Swap Product</Text>
                        </Pressable>
                     </View>
                  );
               })}
            </View>

            {/* Total savings banner */}
            <View className="mt-10 items-center">
               <View className="w-full max-w-2xl bg-white rounded-2xl border border-primary_green/40 shadow-sm px-6 py-4">
                  <View className="flex-row items-center gap-4">
                     <View className="w-12 h-12 rounded-2xl bg-amber-600 items-center justify-center">
                        <FontAwesome6 name="lightbulb" size={18} color="#FFFFFF" />
                     </View>

                     <Text className="text-base font-semibold text-gray-800 flex-1">
                        Total potential savings with substitutions:{" "}
                        <Text className="text-primary_green font-bold">
                           ${totalSavings.toFixed(2)}
                        </Text>
                     </Text>
                  </View>
               </View>
            </View>
         </View>
      </View>
   );
}

function MiniProductCard({
   icon,
   name,
   price,
   variant,
}: {
   icon: string;
   name: string;
   price: number;
   variant: "neutral" | "highlight";
}) {
   const isHighlight = variant === "highlight";

   return (
      <View
         className={[
            "rounded-2xl border p-5 flex-row items-center gap-4",
            isHighlight
               ? "bg-primary_green/10 border-primary_green/20"
               : "bg-white border-gray-200",
         ].join(" ")}
      >
         <View
            className={[
               "w-12 h-12 rounded-2xl items-center justify-center",
               isHighlight ? "bg-primary_green/15" : "bg-gray-100",
            ].join(" ")}
         >
            <FontAwesome6
               name={icon as any}
               size={18}
               color={isHighlight ? "#10B981" : "#6B7280"}
            />
         </View>

         <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-900 mb-1">{name}</Text>
            <Text className={["text-lg font-bold", isHighlight ? "text-primary_green" : "text-gray-800"].join(" ")}>
               ${price.toFixed(2)}
            </Text>
         </View>
      </View>
   );
}
