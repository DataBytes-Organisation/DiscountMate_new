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
          src="https://lookerstudio.google.com/embed/reporting/6de39ec0-e2d9-45a9-8891-1b818076bf4e/page/TzOYE" 
          style={{ border: 0, width: '100%', height: '1000px' }}
          allowFullScreen
          sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
};

export default DashboardEmbed;
