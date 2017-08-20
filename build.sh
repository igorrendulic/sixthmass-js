#!/bin/bash

VERSION=$1
if [ -z $1 ]
  then
    VERSION="0.0.3"
fi
echo "Building sixthmass-main.js"

java -jar compiler/closure-compiler-v20170124.jar --js src/util.js --js src/sixthmass-main.js --js_output_file dist/sixthmass.min."$VERSION".js

echo "Building snippet"
java -jar compiler/closure-compiler-v20170124.jar --js src/sixthmass-snippet.js --js_output_file dist/sixthmass-snippet."$VERSION".js
