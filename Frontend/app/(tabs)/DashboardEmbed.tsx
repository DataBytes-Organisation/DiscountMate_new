import React from 'react';
import { Platform, View, Text } from 'react-native';

const DashboardEmbed = () => {
  if (Platform.OS !== 'web') {
    return (
      <View style={{ padding: 20 }}>
        <Text>Analytics Dashboard is only available on web.</Text>
      </View>
    );
  }

  // Web version
  return (
    <div className="w-full bg-white">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-3xl font-bold text-gray-800 mb-1">Analytics Dashboard</h2>
      </div>
      <div className="w-full h-[200px]"> 
        <iframe
          src="https://app.powerbi.com/reportEmbed?reportId=d02c333d-d402-47e9-9808-46410cd73498&autoAuth=true&ctid=d02378ec-1688-46d5-8540-1c28b5f470f6"
          style={{ border: 0, width: '100%', height: '1000px' }}
          allowFullScreen
          sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
};

export default DashboardEmbed;
