// babel.config.js
module.exports = function (api) {
   api.cache(true);
   return {
      presets: [
         'babel-preset-expo',
         'nativewind/babel',
      ],
      // no plugins here (expo-router and worklets are handled by the preset)
   };
};
