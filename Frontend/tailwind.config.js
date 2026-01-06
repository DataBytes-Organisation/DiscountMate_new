// tailwind.config.js
const nativewind = require('nativewind/preset');

module.exports = {
   content: [
      './app/**/*.{js,jsx,ts,tsx}',
      './components/**/*.{js,jsx,ts,tsx}',
   ],
   presets: [nativewind],
   theme: {
      extend: {
         colors: {
            primary_green: "#10B981",
            secondary_green: "#059669",
            dark: '#1F2937',
            accent: '#FBBF24',
            dark: '#1F2937',
            light: '#F9FAFB',
         },
         fontFamily: {
            sans: ['Inter', 'system-ui', 'sans-serif']
         }
      },
   },
   plugins: [],
};
