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
            primary: "#10B981",
            secondary: "#059669",
            dark: '#1F2937'
         }
      },
   },
   plugins: [],
};
