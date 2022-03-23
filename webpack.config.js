const webpack = require("webpack");

// Builds bundle usable <script>. Includes RGL and all deps, excluding React.
module.exports = {
  mode: "production",
  optimization: {
    minimize: true
  },
  context: __dirname,
  entry: {
    "grid-layout-component": "./index.ts"
  },
  experiments: {
    outputModule: true
  },
  output: {
    path: __dirname + "/dist",
    filename: "[name].min.js",
    libraryTarget: "module"
  },
  devtool: "nosources-source-map",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env": {
        NODE_ENV: JSON.stringify("production")
      }
    }),
    new webpack.optimize.ModuleConcatenationPlugin()
  ],
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"]
  }
};
