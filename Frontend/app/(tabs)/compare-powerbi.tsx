import React, { useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

const POWERBI_COMPARE_REPORT_URL =
   "https://app.powerbi.com/reportEmbed?reportId=7cd666ad-cff9-40d8-ad39-fa7d88f6a086&autoAuth=true&ctid=d02378ec-1688-46d5-8540-1c28b5f470f6";

export default function ComparePowerBIReportScreen() {
   const [isLoading, setIsLoading] = useState(true);
   const [hasError, setHasError] = useState(false);

   if (Platform.OS !== "web") {
      return (
         <View className="flex-1 items-center justify-center p-6 bg-[#F9FAFB]">
            <FontAwesome6 name="chart-line" size={48} color="#10B981" />
            <Text className="text-xl font-semibold text-gray-800 mt-4 mb-2 text-center">
               Comparison Report
            </Text>
            <Text className="text-gray-600 text-center">
               The Power BI report is available on web. Please open this page in a web browser.
            </Text>
         </View>
      );
   }

   return (
      <div className="w-full bg-[#F9FAFB] min-h-screen">
         <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
            <View className="mb-5">
               <Text className="text-3xl font-bold text-gray-900">Product Comparison Report</Text>
            </View>

            {isLoading && (
               <div className="flex items-center justify-center py-20 bg-white rounded-lg border border-gray-200 mb-4">
                  <div className="flex flex-col items-center gap-4">
                     <ActivityIndicator size="large" color="#10B981" />
                     <p className="text-gray-600">Loading report...</p>
                  </div>
               </div>
            )}

            {hasError && (
               <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center mb-4">
                  <p className="text-red-800">
                     Failed to load the Power BI report. Please try again.
                  </p>
               </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
               <iframe
                  src={POWERBI_COMPARE_REPORT_URL}
                  style={{
                     border: 0,
                     width: "100%",
                     height: "calc(100vh - 260px)",
                     minHeight: "820px",
                  }}
                  allowFullScreen
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                     setIsLoading(false);
                     setHasError(true);
                  }}
                  sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
                  title="Product Comparison Power BI Report"
                  className="w-full"
               />
            </div>
         </div>
      </div>
   );
}
