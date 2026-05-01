#!/bin/bash

# Setup script for Voice Activity Detection (VAD)
# Run this after `pnpm install` or if public folder files are missing
#
# Usage: bash scripts/setup-vad.sh

set -e

echo "Setting up VAD dependencies..."

# Create public folder if it doesn't exist
mkdir -p public

# Required files and their sources:
# 1. ONNX Runtime WASM - runs neural network inference in browser
# 2. Silero VAD model - the actual voice detection neural network
# 3. VAD Audio Worklet - processes audio in real-time

echo "Copying ONNX Runtime WASM files..."
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm public/
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs public/

echo "Copying Silero VAD model..."
cp node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx public/

echo "Copying VAD Audio Worklet..."
cp node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js public/

echo ""
echo "Done! The following files are now in public/:"
ls -lh public/ort-wasm-simd-threaded.* public/silero_vad_legacy.onnx public/vad.worklet.bundle.min.js

echo ""
echo "Total size:"
du -sh public/ort-wasm-simd-threaded.* public/silero_vad_legacy.onnx public/vad.worklet.bundle.min.js | tail -1
