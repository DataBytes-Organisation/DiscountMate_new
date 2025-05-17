import React from 'react';

const DashboardEmbed = () => {
  return (
    <div className="w-full bg-white">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-3xl font-bold text-gray-800 mb-1">Analytics Dashboard</h2>
      </div>
      <div className="w-full h-[200px]"> 
        <iframe
        src="https://lookerstudio.google.com/embed/reporting/6de39ec0-e2d9-45a9-8891-1b818076bf4e/page/TzOYE" 
        style={{border:0, width:'100%', height:'1000px'}} allowFullScreen 
        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups
         allow-popups-to-escape-sandbox"></iframe>
      </div>
    </div>
  );
};

export default DashboardEmbed;