const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require("webpack");  // ✅ 追加
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  mode: "production",
  target: "node",  // ✅ これを追加

  entry: "./app.js",
  output: {
    filename: "app.min.js",
    path: path.resolve(__dirname, "public/js"),
  },
  resolve: {
    fallback: {
        "fs": false,
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert/"),
        "net": false,
        "tls": false,
        "timers": require.resolve("timers-browserify"),
        "zlib": require.resolve("browserify-zlib"),
        "url": require.resolve("url/"),
        "os": require.resolve("os-browserify/browser"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "querystring": require.resolve("querystring-es3"),
        "child_process": false,
        "dns": false,
        "events": require.resolve("events/"),
        "process": require.resolve("process/browser"),
      },
      
  },
  externals: {  // ✅ 追加: サーバー専用のモジュールを Webpack のバンドルから除外
    bcrypt: "commonjs bcrypt",
    "node-gyp": "commonjs node-gyp",
    tar: "commonjs tar",
    "fs-extra": "commonjs fs-extra",
    "mock-aws-s3": "commonjs mock-aws-s3",
    "aws-sdk": "commonjs aws-sdk",
    nock: "commonjs nock",
    rimraf: "commonjs rimraf",
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: "../css/style.min.css" }),
    new webpack.ProvidePlugin({
        process: "process/browser", // ✅ `process` の `polyfill`
      }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new CssMinimizerPlugin(),
      new TerserPlugin(),
    ],
  },
};
