import React, { useState } from 'react';
import { Platform, View, Text, ActivityIndicator } from 'react-native';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';

const ProductDashboard = () => {
   const [isLoading, setIsLoading] = useState(true);
   const [hasError, setHasError] = useState(false);

   const POWERBI_DASHBOARD_URL = 'https://app.powerbi.com/reportEmbed?reportId=48518b09-1bb9-4bdd-af68-810349c6f473&autoAuth=true&ctid=d02378ec-1688-46d5-8540-1c28b5f470f6';

   if (Platform.OS !== 'web') {
      return (
         <View className="flex-1 items-center justify-center p-6 bg-[#F9FAFB]">
            <FontAwesome6 name="chart-line" size={48} color="#10B981" />
            <Text className="text-xl font-semibold text-gray-800 mt-4 mb-2 text-center">
               Dashboard
            </Text>
            <Text className="text-gray-600 text-center">
               The Dashboard is only available on web. Please open this page in a web browser to view the PowerBI dashboard.
            </Text>
         </View>
      );
   }

   // Web version
   return (
      <div className="w-full bg-[#F9FAFB] min-h-screen">
         {/* Header Section */}
         <div className="bg-white border-b border-gray-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
               <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-lg flex items-center justify-center shadow-md">
                     <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                     </svg>
                  </div>
                  <div>
                     <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
                  </div>
               </div>
            </div>
         </div>

         {/* Dashboard Container */}
         <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">

            {/* Loading State */}
            {isLoading && (
               <div className="flex items-center justify-center py-20 bg-white rounded-lg border border-gray-200">
                  <div className="flex flex-col items-center gap-4">
                     <ActivityIndicator size="large" color="#10B981" />
                     <p className="text-gray-600">Loading dashboard...</p>
                  </div>
               </div>
            )}

            {/* Error State */}
            {hasError && (
               <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                  <svg className="w-12 h-12 text-red-600 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-800 mt-4">
                     Failed to load the PowerBI dashboard. Please check the dashboard URL.
                  </p>
               </div>
            )}

            {/* PowerBI Dashboard Embed */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
               <iframe
                  src={POWERBI_DASHBOARD_URL}
                  style={{
                     border: 0,
                     width: '100%',
                     height: 'calc(100vh - 300px)',
                     minHeight: '800px',
                  }}
                  allowFullScreen
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                     setIsLoading(false);
                     setHasError(true);
                  }}
                  sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
                  title="Dashboard - PowerBI"
                  className="w-full"
               />
            </div>

            {/* Footer Info */}
            <div className="mt-6 text-center">
               <p className="text-sm text-gray-500">
                  Powered by PowerBI • Last updated: {new Date().toLocaleDateString()}
               </p>
            </div>
         </div>
      </div>
   );
};

export default ProductDashboard;
