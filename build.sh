#!/bin/bash

echo "Building zivorad-js"

java -jar compiler/closure-compiler-v20170124.jar --js src/util.js --js src/zivorad-main.js --js_output_file dist/zivorad.min.0.0.1.js

echo "Building snippet"
java -jar compiler/closure-compiler-v20170124.jar --js src/zivorad-snippet.js --js_output_file dist/zivorad-snippet_0.0.1.js
