#!/bin/bash

VERSION=$1
if [ -z $1 ]
  then
    VERSION="0.0.3"
fi
echo "Building zivorad-js"

java -jar compiler/closure-compiler-v20170124.jar --js src/util.js --js src/zivorad-main.js --js_output_file dist/zivorad.min."$VERSION".js

echo "Building snippet"
java -jar compiler/closure-compiler-v20170124.jar --js src/zivorad-snippet.js --js_output_file dist/zivorad-snippet."$VERSION".js
