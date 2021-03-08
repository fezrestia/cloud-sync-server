const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin"); // Extract CSS from JS.
const OptimizeCssAssetsWebpackPlugin = require("optimize-css-assets-webpack-plugin"); // Compress CSS.
const TerserWebpackPlugin = require("terser-webpack-plugin"); // Compress JS.
const HtmlWebpackPlugin = require("html-webpack-plugin"); // Render HTML.
const CopyWebpackPlugin = require("copy-webpack-plugin"); // Copy static assets.
const { CleanWebpackPlugin } = require("clean-webpack-plugin"); // Clean.

module.exports = (env, argv) => {
  // Environment.
  let isDebug = argv.mode === "development";

  let dstDir = "dst";
  let dstPath = path.resolve(__dirname, dstDir);

  return {
    // chunk name vs file path.
    entry: {
      entry: path.resolve(__dirname, "src/entry.js"),
      architecture_map: [
          path.resolve(__dirname, "src/architecture-map/javascript/packs/architecture_map.tsx"),
          path.resolve(__dirname, "src/architecture-map/css/architecture_map.scss"),
      ],
      sim_stats: path.resolve(__dirname, "src/sim-stats/js/sim_stats.tsx"),
      auth: path.resolve(__dirname, "src/auth/javascript/auth.tsx"),
    },

    output: {
      path: dstPath,
      filename: (chunkData) => {
        if (chunkData.chunk.name == "entry") {
          return "[name].js";
        } else {
          return "[name]/[fullhash].js";
        }
      },
    },

    // Override optimization options.
    optimization: {
      minimizer: [
        new TerserWebpackPlugin({}),
        new OptimizeCssAssetsWebpackPlugin({}),
      ],
    },

    module: {
      rules: [
        // TypeScript.
        {
          test: /\.(ts|tsx)$/, // ext = .ts/.tsx
          use: "ts-loader?configFile=tsconfig.webpack.json", // compile .ts
        },

        // CSS/SCSS/SASS.
        {
          test: /\.(c|sc|sa)ss$/, // ext = .css/.scss/.sass
          use: [ // will apply from end to top
            {
              loader: MiniCssExtractPlugin.loader,
            },
            {
              loader: "css-loader",
              options: {
                url: true, // Not ignore url() method in .scss

                // 0 : No loader (default)
                // 1 : postcss-loader
                // 2 : postcss-loader, sass-loader
                importLoaders: 2,
              },
            },
            {
              loader: "sass-loader",
            },
          ],
        },

        // Images.
        {
          test: /\.(jpg|jpeg|png|gif)$/i,
          use: [
            {
              loader: "file-loader",
              options: {
                name: "[name].[ext]",
                outputPath: (url, resourcePath, context) => {
                  if (/architecture-map/.test(resourcePath)) {
                    return `architecture_map/${url}`
                  }
                  return "images";
                },
              },
            },
          ],
        },

        // HTML.
        {
          test: /\.html$/, // ext = .html
          use: "html-loader",
        },
      ],
    },

    resolve: {
      extensions: [".js", ".ts", ".tsx", ".json"],

      // Import path root.
      modules: [
          path.resolve("./node_modules"),
          path.resolve("./src"),
      ],
    },

    plugins: [
      new CleanWebpackPlugin( {
        verbose: true,
      } ),
      new MiniCssExtractPlugin( {
        filename: ( { name } ) => {
          if (name == "entry") {
            return "[name].css";
          } else {
            return "[name]/[fullhash].css";
          }
        },
      } ),
      new HtmlWebpackPlugin( {
        template: "src/entry.html",
        filename: "entry.html",
        chunks: ["entry"],
      } ),
      new HtmlWebpackPlugin( {
        template: "src/architecture-map/html/view.html",
        filename: "architecture_map/view.html",
        chunks: ["architecture_map"],
      } ),
      new HtmlWebpackPlugin( {
        template: "src/architecture-map/html/edit.html",
        filename: "architecture_map/edit.html",
        chunks: ["architecture_map"],
      } ),
      new HtmlWebpackPlugin( {
        template: "src/sim-stats/html/total.html",
        filename: "sim_stats/total.html",
        chunks: ["sim_stats"],
      } ),
      new HtmlWebpackPlugin( {
        template: "src/auth/html/login.html",
        filename: "auth/login.html",
        chunks: ["auth"],
      } ),
      new CopyWebpackPlugin( {
        patterns: [
          {
            from: "src/static/",
            to: "",
          },
        ],
      } ),
    ],

    devtool: 'inline-source-map',

    // webpack-dev-server
    devServer: {
      contentBase: dstPath,
      host: "0.0.0.0", // Open to local network.
      port: 8080,
      overlay: {
        warnings: true,
        errors: true,
      },
    },
  }; // return
};
