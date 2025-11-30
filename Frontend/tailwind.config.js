// tailwind.config.js
const nativewind = require('nativewind/preset');

module.exports = {
   content: [
      './app/**/*.{js,jsx,ts,tsx}',
      './components/**/*.{js,jsx,ts,tsx}',
   ],
   presets: [nativewind],
   theme: {
      extend: {},
   },
   plugins: [],
};
