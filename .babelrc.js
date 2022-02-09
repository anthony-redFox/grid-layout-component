module.exports = {
  presets: [
    "@babel/react",
    [
      "@babel/preset-typescript",
      {
        allowDeclareFields: true,
        onlyRemoveTypeImports: true
      }
    ]
  ],
  plugins: ["@babel/plugin-transform-modules-commonjs"]
};
