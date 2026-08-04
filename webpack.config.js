const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const eq = line.indexOf('=');
        if (eq < 0) continue;

        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

loadEnvFile(path.resolve(__dirname, '.env'));

const webAllowedHosts = (process.env.STFC_WEB_ALLOWED_HOSTS || 'localhost')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);

module.exports = {
    entry: './src/index.tsx',
    mode: 'development',
    devtool: 'inline-source-map',

    optimization: {
        usedExports: true,
    },

    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/',
        clean: true,
    },

    devServer: {
        static: {
            directory: path.resolve(__dirname, 'dist'),
            publicPath: '/',
        },
        historyApiFallback: true,
        port: Number(process.env.STFC_WEB_PORT || 8080),
        // FORCE EVERYTHING OFF
        hot: false,
        liveReload: false,

        allowedHosts: webAllowedHosts,

        // THIS IS THE KEY: It stops the browser from trying to find /ws
        client: false,

        // This stops the server from even creating the /ws endpoint
        webSocketServer: false,

        proxy: [
            {
                context: ['/api'],
                target: process.env.STFC_LOCAL_SYNC_URL_DEV || 'http://127.0.0.1:8787',
                pathRewrite: { '^/api': '' },
                changeOrigin: true,
            },
        ],
    },

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        // CRITICAL: This tells Webpack to ignore the 16 errors in 
                        // your other folders (local-sync/tools) and only build the UI.
                        onlyCompileBundledFiles: true,
                    }
                },
                exclude: /node_modules/,
            },
            {
                test: /\.(png|svg|jpg|gif|drawio|txt|exe)$/,
                use: {
                    loader: 'file-loader',
                    options: {
                        name: '[path][name].[ext]',
                    },
                },
            },
        ],
    },

    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },

    plugins: [
        new HtmlWebpackPlugin({
            title: 'STFC Tool',
            template: 'assets/index.html',
        }),
        new webpack.DefinePlugin({
            'process.env.STFC_LOCAL_SYNC_URL_DEV': JSON.stringify(process.env.STFC_LOCAL_SYNC_URL_DEV),
            'process.env.STFC_LOCAL_SYNC_URL_PROD': JSON.stringify(process.env.STFC_LOCAL_SYNC_URL_PROD),
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'sitemap.xml',
                    context: path.resolve(__dirname),
                    to: path.resolve(__dirname, 'dist'),
                    noErrorOnMissing: true,
                },
                {
                    from: '_redirects',
                    context: path.resolve(__dirname),
                    to: path.resolve(__dirname, 'dist'),
                    noErrorOnMissing: true,
                },
                {
                    from: '*.json',
                    context: path.resolve(__dirname, 'game-data'),
                    to: path.resolve(__dirname, 'dist', 'data', 'game-data'),
                },
                {
                    from: '*.*',
                    context: path.resolve(__dirname, 'combatlog-data'),
                    to: path.resolve(__dirname, 'dist', 'data', 'combatlog-data'),
                },
                {
                    from: '*.json',
                    context: path.resolve(__dirname, 'game-knowledge'),
                    to: path.resolve(__dirname, 'dist', 'data', 'game-knowledge'),
                },
                {
                    from: '**/*',
                    context: path.resolve(__dirname, 'assets', 'stfc-cache'),
                    to: path.resolve(__dirname, 'dist', 'stfc-assets'),
                    noErrorOnMissing: true,
                },
            ],
        }),
    ],
};
