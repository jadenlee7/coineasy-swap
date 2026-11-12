#!/bin/sh
# Rebuild ../squid-mount.js from ../mount-entry.js.
#   cd build && npm install && sh build.sh
set -e
cp ../mount-entry.js ./mount-entry.js
npx esbuild mount-entry.js --bundle --minify --format=iife --platform=browser \
  --define:process.env.NODE_ENV=\"production\" --define:global=globalThis \
  --inject:./stubs/globals.js \
  --alias:crypto=./stubs/empty.js --alias:http=./stubs/empty.js --alias:https=./stubs/empty.js \
  --alias:url=./stubs/empty.js --alias:stream=stream-browserify \
  --external:@emotion/is-prop-valid --log-limit=0 --outfile=../squid-mount.js
rm -f ./mount-entry.js
