module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    ["module-resolver",{
      "alias":{
        "@orbyt/screen": "./src/screens",
      }
    }],
    ["module:react-native-dotenv", {
      moduleName: "@env",
      path: ".env",
    }],
    'react-native-reanimated/plugin'
  ],
};
 