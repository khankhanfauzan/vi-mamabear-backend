import path from "node:path";
const TsConfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
module.exports = {
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
        plugins: [
            new TsConfigPathsPlugin({
                configFile: './tsconfig.json',
                extensions: ['.js', '.ts'],
            }),
        ],
    },
};
