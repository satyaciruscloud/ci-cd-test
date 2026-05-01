# Browser Voice Activity Detection (VAD) Integration Guide

A complete guide to integrate real-time, neural network-based voice activity detection into any React or Next.js project using the Silero VAD model.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Setup Static Assets](#setup-static-assets)
4. [Configure Next.js](#configure-nextjs)
5. [Create the VAD Hook](#create-the-vad-hook)
6. [Usage in Components](#usage-in-components)
7. [Audio Playback & Download Utils](#audio-playback--download-utils)
8. [Configuration Options](#configuration-options)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+
- React 18+ or Next.js 13+
- Browser with WebAssembly and AudioWorklet support (all modern browsers)

---

## Installation

```bash
# Using pnpm
pnpm add @ricky0123/vad-web onnxruntime-web

# Using npm
npm install @ricky0123/vad-web onnxruntime-web

# Using yarn
yarn add @ricky0123/vad-web onnxruntime-web
```

---

## Setup Static Assets

The VAD library requires WASM and ONNX model files to be served as static assets. These cannot be bundled by webpack/Next.js.

### Option A: Manual Copy

Create `scripts/setup-vad.sh`:

```bash
#!/bin/bash

echo "Setting up VAD static assets..."

mkdir -p public

# ONNX Runtime WASM files (required for neural network inference)
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm public/
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs public/

# Silero VAD model and audio worklet
cp node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx public/
cp node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js public/

echo "VAD setup complete. Files copied to public/"
```

Run it:
```bash
bash scripts/setup-vad.sh
```

### Option B: Auto-run on Install

Add to `package.json`:

```json
{
  "scripts": {
    "setup:vad": "bash scripts/setup-vad.sh",
    "postinstall": "bash scripts/setup-vad.sh"
  }
}
```

### Required Files Summary

| File | Source | Size | Purpose |
|------|--------|------|---------|
| `ort-wasm-simd-threaded.wasm` | onnxruntime-web | ~12MB | WASM runtime for neural network |
| `ort-wasm-simd-threaded.mjs` | onnxruntime-web | ~24KB | JavaScript loader for WASM |
| `silero_vad_legacy.onnx` | @ricky0123/vad-web | ~1.8MB | Silero VAD model |
| `vad.worklet.bundle.min.js` | @ricky0123/vad-web | ~2.5KB | Audio Worklet processor |

---

## Configure Next.js

Update `next.config.mjs` to add required headers for SharedArrayBuffer (needed for threaded WASM):

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for SharedArrayBuffer (threaded WASM)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

> **Note:** These headers enable `SharedArrayBuffer` which is required for multi-threaded WASM execution. Without them, you'll get WASM initialization errors.

---

## Create the VAD Hook

Create `hooks/use-vad.ts`:

```typescript
"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { MicVAD, RealTimeVADOptions } from "@ricky0123/vad-web"

// ============================================================
// TYPES
// ============================================================

export interface VADState {
  /** Whether the VAD is currently listening to the microphone */
  isListening: boolean
  /** Whether speech is currently being detected */
  isSpeaking: boolean
  /** Whether the VAD model is loading */
  isLoading: boolean
  /** Error message if initialization failed */
  error: string | null
  /** Current audio level (0-1) for visualization */
  audioLevel: number
}

export interface UseVADOptions {
  /**
   * Threshold to START detecting speech (0-1)
   * Higher = requires more confident speech detection
   * @default 0.5
   */
  positiveSpeechThreshold?: number

  /**
   * Threshold to STOP detecting speech (0-1)
   * Lower = more sensitive to silence
   * @default 0.35
   */
  negativeSpeechThreshold?: number

  /**
   * Minimum frames of speech required to trigger
   * Higher = ignores short sounds/noise
   * @default 6
   */
  minSpeechFrames?: number

  /**
   * Frames of silence before speech ends
   * Lower = faster end detection (each frame ~96ms)
   * @default 3
   */
  redemptionFrames?: number

  /**
   * Frames to include before speech start
   * @default 5
   */
  preSpeechPadFrames?: number

  // --------------------------------------------------------
  // CALLBACKS - Wire these to your UI/logic
  // --------------------------------------------------------

  /** Called when speech starts */
  onSpeechStart?: () => void

  /** Called when speech ends, with captured audio data */
  onSpeechEnd?: (audio: Float32Array) => void

  /** Called when speech was too short (misfire) */
  onVADMisfire?: () => void
}

export interface UseVADReturn extends VADState {
  /** Start listening to microphone */
  startListening: () => Promise<void>
  /** Stop listening */
  stopListening: () => void
}

// ============================================================
// HOOK IMPLEMENTATION
// ============================================================

export function useVAD(options: UseVADOptions = {}): UseVADReturn {
  const {
    positiveSpeechThreshold = 0.5,
    negativeSpeechThreshold = 0.35,
    minSpeechFrames = 6,
    redemptionFrames = 3,
    preSpeechPadFrames = 5,
    onSpeechStart,
    onSpeechEnd,
    onVADMisfire,
  } = options

  const [state, setState] = useState<VADState>({
    isListening: false,
    isSpeaking: false,
    isLoading: false,
    error: null,
    audioLevel: 0,
  })

  const vadRef = useRef<MicVAD | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Audio level monitoring for visualizations
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    const normalizedLevel = Math.min(average / 128, 1)

    setState(prev => ({ ...prev, audioLevel: normalizedLevel }))
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
  }, [])

  // Start listening
  const startListening = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      })
      streamRef.current = stream

      // Setup audio analysis for level monitoring
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      // Initialize VAD with Silero model
      const vadOptions: Partial<RealTimeVADOptions> = {
        positiveSpeechThreshold,
        negativeSpeechThreshold,
        minSpeechFrames,
        preSpeechPadFrames,
        redemptionFrames,
        // Static asset paths
        modelURL: "/silero_vad_legacy.onnx",
        workletURL: "/vad.worklet.bundle.min.js",
        onnxWASMBasePath: "/",
        onSpeechStart: () => {
          setState(prev => ({ ...prev, isSpeaking: true }))
          onSpeechStart?.()
        },
        onSpeechEnd: (audio: Float32Array) => {
          setState(prev => ({ ...prev, isSpeaking: false }))
          onSpeechEnd?.(audio)
        },
        onVADMisfire: () => {
          setState(prev => ({ ...prev, isSpeaking: false }))
          onVADMisfire?.()
        },
      }

      vadRef.current = await MicVAD.new(vadOptions)
      vadRef.current.start()

      setState(prev => ({
        ...prev,
        isListening: true,
        isLoading: false,
      }))

      // Start audio level monitoring
      updateAudioLevel()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize VAD"
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
    }
  }, [
    positiveSpeechThreshold,
    negativeSpeechThreshold,
    minSpeechFrames,
    preSpeechPadFrames,
    redemptionFrames,
    onSpeechStart,
    onSpeechEnd,
    onVADMisfire,
    updateAudioLevel,
  ])

  // Stop listening
  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (vadRef.current) {
      vadRef.current.pause()
      vadRef.current.destroy()
      vadRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    analyserRef.current = null

    setState({
      isListening: false,
      isSpeaking: false,
      isLoading: false,
      error: null,
      audioLevel: 0,
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  return {
    ...state,
    startListening,
    stopListening,
  }
}
```

---

## Usage in Components

### Basic Usage

```tsx
"use client"

import { useVAD } from "@/hooks/use-vad"

export function VoiceRecorder() {
  const {
    isListening,
    isSpeaking,
    isLoading,
    error,
    audioLevel,        // Use for: visualizations, waveforms, meters
    startListening,
    stopListening,
  } = useVAD({
    // Called when user starts speaking
    onSpeechStart: () => {
      // UI: Show "Recording..." indicator
      // Logic: Start any timers, update state
    },

    // Called when user stops speaking, with audio data
    onSpeechEnd: (audio: Float32Array) => {
      // UI: Show "Processing..." indicator
      // Logic: Send audio to transcription API, save locally, etc.
      console.log("Captured audio samples:", audio.length)
    },

    // Called when speech was too short (noise/false positive)
    onVADMisfire: () => {
      // UI: Maybe show brief "Too short" message
      // Logic: Ignore, no action needed
    },
  })

  // UI INTEGRATION POINTS:
  // - isLoading: Show loading spinner while model initializes
  // - isListening: Toggle button state (Start/Stop)
  // - isSpeaking: Show speaking indicator (pulsing dot, waveform)
  // - audioLevel: Drive visualizations (0-1 normalized value)
  // - error: Display error message

  return (
    <div>
      <button
        onClick={isListening ? stopListening : startListening}
        disabled={isLoading}
      >
        {isLoading ? "Loading..." : isListening ? "Stop" : "Start"}
      </button>

      {isSpeaking && <span>Speaking...</span>}
      {error && <span style={{ color: "red" }}>{error}</span>}
    </div>
  )
}
```

### With Audio Storage

```tsx
"use client"

import { useState } from "react"
import { useVAD } from "@/hooks/use-vad"

interface Recording {
  id: string
  audio: Float32Array
  timestamp: Date
  duration: number
}

export function VoiceRecorderWithStorage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [speechStartTime, setSpeechStartTime] = useState<number | null>(null)

  const { isListening, isSpeaking, startListening, stopListening } = useVAD({
    onSpeechStart: () => {
      setSpeechStartTime(Date.now())
    },
    onSpeechEnd: (audio) => {
      const duration = speechStartTime ? Date.now() - speechStartTime : 0
      setSpeechStartTime(null)

      // Store the recording
      setRecordings(prev => [
        {
          id: crypto.randomUUID(),
          audio,
          timestamp: new Date(),
          duration,
        },
        ...prev,
      ])
    },
  })

  // UI: Render recordings list with play/download buttons
  // See "Audio Playback & Download Utils" section below
}
```

---

## Audio Playback & Download Utils

Create `lib/audio-utils.ts`:

```typescript
/**
 * Convert Float32Array audio samples to WAV blob
 * @param samples - Raw audio samples from VAD
 * @param sampleRate - Sample rate (VAD uses 16000 Hz)
 */
export function float32ToWav(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  // Helper to write string to buffer
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // WAV header
  writeString(0, "RIFF")
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)           // PCM chunk size
  view.setUint16(20, 1, true)            // PCM format
  view.setUint16(22, 1, true)            // Mono
  view.setUint32(24, sampleRate, true)   // Sample rate
  view.setUint32(28, sampleRate * 2, true) // Byte rate
  view.setUint16(32, 2, true)            // Block align
  view.setUint16(34, 16, true)           // Bits per sample
  writeString(36, "data")
  view.setUint32(40, samples.length * 2, true)

  // Convert Float32 to Int16
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: "audio/wav" })
}

/**
 * Play audio from Float32Array samples
 */
export async function playAudio(
  samples: Float32Array,
  sampleRate = 16000
): Promise<void> {
  const audioContext = new AudioContext()
  const audioBuffer = audioContext.createBuffer(1, samples.length, sampleRate)
  audioBuffer.getChannelData(0).set(samples)

  const source = audioContext.createBufferSource()
  source.buffer = audioBuffer
  source.connect(audioContext.destination)
  source.start()

  return new Promise((resolve) => {
    source.onended = () => {
      audioContext.close()
      resolve()
    }
  })
}

/**
 * Download audio as WAV file
 */
export function downloadAudio(samples: Float32Array, filename: string): void {
  const blob = float32ToWav(samples)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".wav") ? filename : `${filename}.wav`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Get audio duration in seconds
 */
export function getAudioDuration(samples: Float32Array, sampleRate = 16000): number {
  return samples.length / sampleRate
}
```

### Usage with Utils

```tsx
import { playAudio, downloadAudio } from "@/lib/audio-utils"

// In your component
<button onClick={() => playAudio(recording.audio)}>
  Play
</button>

<button onClick={() => downloadAudio(recording.audio, `recording-${recording.id}`)}>
  Download
</button>
```

---

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `positiveSpeechThreshold` | number | 0.5 | Confidence threshold to START speech detection (0-1) |
| `negativeSpeechThreshold` | number | 0.35 | Confidence threshold to STOP speech detection (0-1) |
| `minSpeechFrames` | number | 6 | Minimum frames of speech required to trigger |
| `redemptionFrames` | number | 3 | Silence frames before speech ends (~96ms each) |
| `preSpeechPadFrames` | number | 5 | Frames to include before detected speech start |

### Tuning Guide

**For noisy environments:**
```tsx
useVAD({
  positiveSpeechThreshold: 0.7,  // Higher = more strict
  negativeSpeechThreshold: 0.5,  // Higher = needs clearer silence
  minSpeechFrames: 10,           // Ignore short sounds
})
```

**For fast response:**
```tsx
useVAD({
  redemptionFrames: 1,           // Minimal delay after speech ends
  minSpeechFrames: 3,            // Quick trigger
})
```

**For capturing full sentences:**
```tsx
useVAD({
  redemptionFrames: 8,           // Wait longer for pauses
  preSpeechPadFrames: 10,        // Include more lead-in
})
```

---

## Troubleshooting

### Error: "no available backend found"

**Cause:** WASM files not found in public folder.

**Fix:** Run `pnpm setup:vad` or manually copy files to `public/`.

---

### Error: "SharedArrayBuffer is not defined"

**Cause:** Missing COOP/COEP headers.

**Fix:** Add headers to `next.config.mjs` (see [Configure Next.js](#configure-nextjs)).

---

### Error: "NotAllowedError: Permission denied"

**Cause:** Microphone permission blocked.

**Fix:** User must allow microphone access. Cannot be bypassed programmatically.

---

### Speech detection is too slow to stop

**Cause:** High `redemptionFrames` value.

**Fix:** Lower `redemptionFrames` to 2-3 for faster response.

---

### Model takes long to load initially

**Cause:** First-time WASM compilation.

**Fix:** This is normal (~1-2 seconds). Show a loading indicator. Subsequent loads are cached by the browser.

---

## File Structure Summary

```
your-project/
├── hooks/
│   └── use-vad.ts              # VAD hook
├── lib/
│   └── audio-utils.ts          # Playback/download utilities
├── scripts/
│   └── setup-vad.sh            # Asset copy script
├── public/
│   ├── ort-wasm-simd-threaded.wasm
│   ├── ort-wasm-simd-threaded.mjs
│   ├── silero_vad_legacy.onnx
│   └── vad.worklet.bundle.min.js
├── next.config.mjs             # With COOP/COEP headers
└── package.json                # With postinstall script
```

---

## License

Silero VAD model is licensed under MIT. See [@ricky0123/vad-web](https://github.com/ricky0123/vad) for details.
