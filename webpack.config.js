const webpack = require("webpack");
const path = require("path");
const DtsBundleWebpack = require("dts-bundle-webpack");

// Builds bundle usable <script>. Includes RGL and all deps, excluding React.

const entryName = "grid-layout-component";
const distFolder = path.resolve(__dirname, "./dist");

module.exports = {
  mode: "production",
  optimization: {
    minimize: true
  },
  context: __dirname,
  entry: {
    [entryName]: "./index.ts"
  },
  experiments: {
    outputModule: true
  },
  output: {
    path: distFolder,
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
    new DtsBundleWebpack({
      name: entryName,
      main: path.resolve(distFolder, "index.d.ts"),
      removeSource: true,
      out: "index.d.ts"
    }),
    new webpack.optimize.ModuleConcatenationPlugin()
  ],
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"]
  }
};
