var path = require('path');
var webpack = require('webpack');

module.exports = [
{
    name: 'server',
    target: 'node',
    entry: ['./dev_server.js'],
    output: {
        path: __dirname,
        filename: 'bin/zivorad-bundle-0.0.1.js'
    },
    module: {
        loaders: [
            { 
                test: /\.js$/,
                loader:'babel-loader',
                // Skip any files outside of your project's `src` directory
                include: [
                    path.resolve(__dirname, "src"),
                ],
                query: {
                    presets: ['es2015','stage-2']
                },
                include: /(node_modules|bower_components)/
            },
            {
                test:  /\.json$/, 
                loader: 'json-loader'
            }
        ]
    }
}]
