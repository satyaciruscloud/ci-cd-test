"use client"

import { useRef, useCallback, useState } from "react"
import { Play, Square, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface SpeechEvent {
  id: string
  type: "speech_start" | "speech_end" | "misfire"
  timestamp: Date
  duration?: number
  audioData?: Float32Array
}

interface SpeechLogProps {
  events: SpeechEvent[]
  className?: string
}

// Convert Float32Array to WAV blob
function float32ToWav(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true) // PCM
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // Mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // Byte rate
  view.setUint16(32, 2, true) // Block align
  view.setUint16(34, 16, true) // Bits per sample
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

export function SpeechLog({ events, className }: SpeechLogProps) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const playAudio = useCallback(async (event: SpeechEvent) => {
    if (!event.audioData) return

    // Stop any currently playing audio
    if (currentSourceRef.current) {
      currentSourceRef.current.stop()
      currentSourceRef.current = null
    }

    // Create audio context if needed
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    const ctx = audioContextRef.current
    const sampleRate = 16000 // VAD uses 16kHz

    // Create audio buffer
    const audioBuffer = ctx.createBuffer(1, event.audioData.length, sampleRate)
    audioBuffer.getChannelData(0).set(event.audioData)

    // Create and play source
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    
    setPlayingId(event.id)
    source.onended = () => {
      setPlayingId(null)
      currentSourceRef.current = null
    }
    
    currentSourceRef.current = source
    source.start()
  }, [])

  const stopAudio = useCallback(() => {
    if (currentSourceRef.current) {
      currentSourceRef.current.stop()
      currentSourceRef.current = null
      setPlayingId(null)
    }
  }, [])

  const downloadAudio = useCallback((event: SpeechEvent) => {
    if (!event.audioData) return

    const wavBlob = float32ToWav(event.audioData)
    const url = URL.createObjectURL(wavBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = `speech_${formatTime(event.timestamp).replace(/:/g, "-")}.wav`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">Speech Events</h3>
      <div className="h-48 overflow-y-auto rounded-lg border bg-card p-3 space-y-1">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No speech events yet. Start listening to detect speech.
          </p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className={cn(
                "flex items-center gap-3 text-sm px-2 py-1.5 rounded",
                event.type === "speech_start" && "bg-green-500/10",
                event.type === "speech_end" && "bg-blue-500/10",
                event.type === "misfire" && "bg-yellow-500/10"
              )}
            >
              <span className="text-muted-foreground font-mono text-xs">
                {formatTime(event.timestamp)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  event.type === "speech_start" && "text-green-600 dark:text-green-400",
                  event.type === "speech_end" && "text-blue-600 dark:text-blue-400",
                  event.type === "misfire" && "text-yellow-600 dark:text-yellow-400"
                )}
              >
                {event.type === "speech_start" && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Speech Started
                  </>
                )}
                {event.type === "speech_end" && (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Speech Ended</span>
                      {event.duration && (
                        <span className="text-muted-foreground">
                          ({formatDuration(event.duration)})
                        </span>
                      )}
                    </div>
                    {event.audioData && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (playingId === event.id) {
                              stopAudio()
                            } else {
                              playAudio(event)
                            }
                          }}
                          title={playingId === event.id ? "Stop" : "Play"}
                        >
                          {playingId === event.id ? (
                            <Square className="h-3 w-3" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadAudio(event)
                          }}
                          title="Download WAV"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {event.type === "misfire" && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    Misfire (noise detected)
                  </>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
