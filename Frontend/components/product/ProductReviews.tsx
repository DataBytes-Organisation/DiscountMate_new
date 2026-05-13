import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

interface Review {
   id: string;
   author: string;
   rating: number;
   date: string;
   comment: string;
   helpful: number;
}

interface ProductReviewsProps {
   productId?: string | string[];
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
   const [showAllReviews, setShowAllReviews] = useState(false);

   const overallRating = 4.5;
   const reviewCount = 1247;

   const starDistribution: Record<number, number> = {
      5: 848,
      4: 274,
      3: 87,
      2: 25,
      1: 13,
   };

   const reviews: Review[] = [
      {
         id: "1",
         author: "Sarah M.",
         rating: 5,
         date: "2 weeks ago",
         comment:
            "Excellent quality milk at a great price. Fresh taste and perfect consistency. My family loves it for both drinking and cooking. Highly recommend!",
         helpful: 24,
      },
      {
         id: "2",
         author: "David L.",
         rating: 4,
         date: "1 month ago",
         comment:
            "Good value for money. The taste is good but I've noticed the shelf life is sometimes shorter than expected. Overall satisfied with the purchase.",
         helpful: 18,
      },
      {
         id: "3",
         author: "Emma R.",
         rating: 5,
         date: "3 days ago",
         comment:
            "Best milk I've tried. Creamy texture and fresh taste. Perfect for my morning coffee. The 2L size is ideal for our household. Will definitely buy again.",
         helpful: 9,
      },
   ];

   const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 3);

   const totalReviews = Object.values(starDistribution).reduce(
      (a, b) => a + b,
      0
   );

   const getStarPercentage = (star: number) => {
      const value = starDistribution[star] || 0;
      if (!totalReviews) {
         return "0";
      }
      return ((value / totalReviews) * 100).toFixed(0);
   };

   const renderStars = (rating: number, size = 14) => (
      <View className="flex-row">
         {Array.from({ length: 5 }).map((_, i) => (
            <FontAwesome6
               key={i}
               name="star"
               size={size}
               color={i < rating ? "#FBBF24" : "#E5E7EB"}
               solid={i < rating}
            />
         ))}
      </View>
   );

   const renderAvatar = (name: string) => {
      const initial = name.trim().charAt(0).toUpperCase();
      return (
         <View className="w-10 h-10 rounded-full bg-gray-200 mr-3 items-center justify-center">
            <Text className="text-sm font-semibold text-gray-700">
               {initial}
            </Text>
         </View>
      );
   };

   return (
      <View className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
         {/* Header */}
         <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-gray-900">
               Customer Reviews
            </Text>
            <Pressable className="bg-primary_green rounded-xl px-5 py-2.5">
               <Text className="text-sm font-semibold text-white">
                  Write a Review
               </Text>
            </Pressable>
         </View>

         {/* Rating + distribution row */}
         <View className="flex-row gap-8 mb-6">
            {/* Left: overall rating */}
            <View className="w-32">
               <Text className="text-4xl font-bold text-gray-900">
                  {overallRating.toFixed(1)}
               </Text>
               <View className="flex-row items-center mt-1">
                  {renderStars(Math.round(overallRating), 16)}
               </View>
               <Text className="text-sm text-gray-600 mt-2">
                  {reviewCount.toLocaleString()} reviews
               </Text>
            </View>

            {/* Right: star breakdown */}
            <View className="flex-1">
               {[5, 4, 3, 2, 1].map((star) => (
                  <View
                     key={star}
                     className="flex-row items-center gap-2 mb-1.5"
                  >
                     <Text className="text-xs text-gray-600 w-10">
                        {star} star
                     </Text>
                     <View className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <View
                           className="h-full bg-primary_green"
                           style={{ width: `${getStarPercentage(star)}%` }}
                        />
                     </View>
                     <Text className="text-xs text-gray-600 w-12 text-right">
                        {starDistribution[star]}
                     </Text>
                  </View>
               ))}
            </View>
         </View>

         {/* Reviews list */}
         <View>
            {displayedReviews.map((review, index) => (
               <View
                  key={review.id}
                  className={[
                     "pb-4",
                     index < displayedReviews.length - 1
                        ? "mb-4 border-b border-gray-100"
                        : "",
                  ].join(" ")}
               >
                  <View className="flex-row items-start mb-2">
                     {renderAvatar(review.author)}
                     <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1">
                           <Text className="font-semibold text-gray-900">
                              {review.author}
                           </Text>
                           {renderStars(review.rating, 12)}
                           <Text className="text-xs text-gray-500">
                              {review.date}
                           </Text>
                        </View>
                        <Text className="text-sm text-gray-700 leading-5">
                           {review.comment}
                        </Text>
                     </View>
                  </View>

                  <View
                     className="flex-row items-center gap-4"
                     style={{ marginLeft: 52 }} // align with text start after avatar
                  >
                     <Pressable className="flex-row items-center gap-1.5">
                        <FontAwesome6
                           name="thumbs-up"
                           size={12}
                           color="#6B7280"
                        />
                        <Text className="text-xs text-gray-600">
                           Helpful ({review.helpful})
                        </Text>
                     </Pressable>
                     <Pressable>
                        <Text className="text-xs text-gray-600">Reply</Text>
                     </Pressable>
                  </View>
               </View>
            ))}
         </View>

         {/* Load more button */}
         {!showAllReviews && reviews.length > 3 && (
            <Pressable
               onPress={() => setShowAllReviews(true)}
               className="mt-4 border border-gray-200 rounded-xl py-3 items-center"
            >
               <Text className="text-sm font-semibold text-gray-900">
                  Load More Reviews
               </Text>
            </Pressable>
         )}
      </View>
   );
}
