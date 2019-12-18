const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin"); // Extract CSS from JS.
const OptimizeCssAssetsWebpackPlugin = require("optimize-css-assets-webpack-plugin"); // Compress CSS.
const TerserWebpackPlugin = require("terser-webpack-plugin"); // Compress JS.
const HtmlWebpackPlugin = require("html-webpack-plugin"); // Render HTML.
const CopyWebpackPlugin = require("copy-webpack-plugin"); // Copy static assets.
const CleanWebpackPlugin = require("clean-webpack-plugin"); // Clean.

module.exports = (env, argv) => {
    // Environment.
    isDebug = argv.mode === "development";

    dstDir = "dst";
    dstPath = path.resolve(__dirname, dstDir);
    filenameJS = "entry-[hash].js";
    filenameCSS = "entry-[hash].css";

    return {
        entry: path.resolve(__dirname, "src/entry.ts"),
        output: {
            path: dstPath,
            filename: filenameJS,
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
                    use: "ts-loader", // compile .ts
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
                                url: false, // Ignore url() method in .scss

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

                // HTML.
                {
                    test: /\.html$/, // ext = .html
                    use: "html-loader",
                },
            ],
        },

        resolve: {
            extensions: [".js", ".ts", ".tsx", ".json"],
        },

        plugins: [
            new CleanWebpackPlugin(),
            new MiniCssExtractPlugin( {
                filename: filenameCSS,
            } ),
            new HtmlWebpackPlugin( {
                template: "src/entry.html",
                filename: "entry.html",
                files: {
                    "js": [filenameJS],
                    "css": [filenameCSS],
                },
            } ),
            new CopyWebpackPlugin( [
                {
                    from: "src/static/",
                    to: "",
                },
            ] ),
        ],

        devtool: 'inline-source-map',

    }; // return
};
