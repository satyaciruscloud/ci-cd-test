"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react"
import { MicVAD, type RealTimeVADOptions } from "@ricky0123/vad-web"

export interface VADState {
  isListening: boolean
  isSpeaking: boolean
  isLoading: boolean
  error: string | null
  audioLevel: number
}

export interface VADCallbacks {
  onSpeechStart?: () => void
  onSpeechEnd?: (_audio: Float32Array) => void
  onVADMisfire?: () => void
}

export interface UseVADOptions extends VADCallbacks {
  /** Probability threshold for speech detection (0-1, default: 0.5) */
  positiveSpeechThreshold?: number
  /** Probability threshold for silence detection (0-1, default: 0.35) */
  negativeSpeechThreshold?: number
  /** Minimum number of speech frames to trigger detection (default: 6) */
  minSpeechFrames?: number
  /** Number of frames to pad before speech (default: 10) */
  preSpeechPadFrames?: number
  /** Redemption frames - silence frames needed before speech ends (default: 3) */
  redemptionFrames?: number
  /** Auto-start listening on mount */
  autoStart?: boolean
}

export function useVAD(options: UseVADOptions = {}) {
  const {
    positiveSpeechThreshold = 0.5,
    negativeSpeechThreshold = 0.35,
    minSpeechFrames = 6,
    preSpeechPadFrames = 10,
    redemptionFrames = 3,
    autoStart = false,
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
  const isListeningRef = useRef(state.isListening)

  useLayoutEffect(() => {
    isListeningRef.current = state.isListening
  }, [state.isListening])

  const audioLevelLoopRef = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    audioLevelLoopRef.current = () => {
      if (analyserRef.current && isListeningRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)

        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i]
        }
        const rms = Math.sqrt(sum / dataArray.length)
        const normalizedLevel = Math.min(rms / 128, 1)

        setState(prev => ({ ...prev, audioLevel: normalizedLevel }))
        animationFrameRef.current = requestAnimationFrame(() => {
          audioLevelLoopRef.current()
        })
      }
    }
  }, [])

  const updateAudioLevel = useCallback(() => {
    audioLevelLoopRef.current()
  }, [])

  const startListening = useCallback(async () => {
    if (vadRef.current) {
      vadRef.current.start()
      setState(prev => ({ ...prev, isListening: true }))
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      })
      streamRef.current = stream

      // Set up audio analysis for level visualization
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      // Initialize VAD with Silero model - specify paths for WASM and model files
      const vadOptions: Partial<RealTimeVADOptions> = {
        positiveSpeechThreshold,
        negativeSpeechThreshold,
        minSpeechFrames,
        preSpeechPadFrames,
        redemptionFrames,
        // Specify paths to the model and worklet files in public directory
        modelURL: "/silero_vad_legacy.onnx",
        workletURL: "/vad.worklet.bundle.min.js",
        // Configure ONNX Runtime to use the WASM files from public directory
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
        isLoading: false, 
        isListening: true,
        error: null 
      }))

      // Start audio level monitoring
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize VAD"
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
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

  const stopListening = useCallback(() => {
    if (vadRef.current) {
      vadRef.current.pause()
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    setState(prev => ({ 
      ...prev, 
      isListening: false, 
      isSpeaking: false,
      audioLevel: 0 
    }))
  }, [])

  const destroy = useCallback(() => {
    stopListening()
    
    if (vadRef.current) {
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
  }, [stopListening])

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart) {
      queueMicrotask(() => {
        void startListening()
      })
    }

    return () => {
      destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    startListening,
    stopListening,
    destroy,
  }
}
