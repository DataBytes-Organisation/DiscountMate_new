import React from 'react';

const DashboardEmbed = () => {
  return (
    <div className="w-full bg-white">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-3xl font-bold text-gray-800 mb-1">Analytics Dashboard</h2>
      </div>
      <div className="w-full h-[200px]"> 
        <iframe 
          src="https://lookerstudio.google.com/embed/reporting/0d29b7f6-5fb9-4ffb-984f-6f5a2833199d/page/zJKBE"
          className="w-full h-full border-0"
          style={{
            minHeight: '200px',
            width: '100%'
          }}
          frameBorder="0"
          allowFullScreen
          sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
};

export default DashboardEmbed;