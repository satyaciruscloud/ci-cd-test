"use client"

import { useState, useCallback, useRef } from "react"
import { Mic, MicOff, Volume2, Loader2, AlertCircle, Settings2 } from "lucide-react"
import { useVAD } from "@/hooks/use-vad"
import { VADVisualizer } from "./vad-visualizer"
import { SpeechLog, type SpeechEvent } from "./speech-log"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

export function VADDemo() {
  const [events, setEvents] = useState<SpeechEvent[]>([])
  const [speechCount, setSpeechCount] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const speechStartTimeRef = useRef<number | null>(null)

  // VAD settings
  const [positiveSpeechThreshold, setPositiveSpeechThreshold] = useState(0.5)
  const [negativeSpeechThreshold, setNegativeSpeechThreshold] = useState(0.35)
  const [minSpeechFrames, setMinSpeechFrames] = useState(6)
  const [redemptionFrames, setRedemptionFrames] = useState(3)

  const addEvent = useCallback((type: SpeechEvent["type"], duration?: number, audioData?: Float32Array) => {
    const newEvent: SpeechEvent = {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date(),
      duration,
      audioData,
    }
    setEvents((prev) => [newEvent, ...prev].slice(0, 50))
  }, [])

  const handleSpeechStart = useCallback(() => {
    speechStartTimeRef.current = Date.now()
    addEvent("speech_start")
  }, [addEvent])

  const handleSpeechEnd = useCallback((audio: Float32Array) => {
    const duration = speechStartTimeRef.current
      ? Date.now() - speechStartTimeRef.current
      : undefined
    speechStartTimeRef.current = null
    // Pass the audio data to store with the event for playback/download
    addEvent("speech_end", duration, audio)
    setSpeechCount((prev) => prev + 1)
  }, [addEvent])

  const handleVADMisfire = useCallback(() => {
    speechStartTimeRef.current = null
    addEvent("misfire")
  }, [addEvent])

  const {
    isListening,
    isSpeaking,
    isLoading,
    error,
    audioLevel,
    startListening,
    stopListening,
  } = useVAD({
    positiveSpeechThreshold,
    negativeSpeechThreshold,
    minSpeechFrames,
    redemptionFrames,
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleSpeechEnd,
    onVADMisfire: handleVADMisfire,
  })

  const handleToggle = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Voice Activity Detection</CardTitle>
          <CardDescription>
            Real-time speech detection using Silero VAD model running in your browser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status indicators */}
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  isListening ? "bg-green-500 animate-pulse" : "bg-muted"
                )}
              />
              <span className="text-sm text-muted-foreground">
                {isListening ? "Listening" : "Paused"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  isSpeaking ? "bg-blue-500 animate-pulse" : "bg-muted"
                )}
              />
              <span className="text-sm text-muted-foreground">
                {isSpeaking ? "Speaking" : "Silent"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {Math.round(audioLevel * 100)}%
              </span>
            </div>
          </div>

          {/* Visualizer */}
          <div className="flex justify-center py-4">
            <VADVisualizer
              isListening={isListening}
              isSpeaking={isSpeaking}
              audioLevel={audioLevel}
            />
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Controls */}
          <div className="flex flex-col items-center gap-4">
            <Button
              size="lg"
              variant={isListening ? "destructive" : "default"}
              onClick={handleToggle}
              disabled={isLoading}
              className="w-48"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading Model...
                </>
              ) : isListening ? (
                <>
                  <MicOff className="mr-2 h-5 w-5" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-5 w-5" />
                  Start Listening
                </>
              )}
            </Button>

            <p className="text-sm text-muted-foreground">
              Speech segments detected: <span className="font-semibold">{speechCount}</span>
            </p>
          </div>

          {/* Settings */}
          <Collapsible open={showSettings} onOpenChange={setShowSettings}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full" size="sm">
                <Settings2 className="mr-2 h-4 w-4" />
                {showSettings ? "Hide Settings" : "Show Settings"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Speech Threshold</Label>
                  <span className="text-sm text-muted-foreground">
                    {positiveSpeechThreshold.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[positiveSpeechThreshold]}
                  onValueChange={([v]) => setPositiveSpeechThreshold(v)}
                  min={0.1}
                  max={0.95}
                  step={0.05}
                  disabled={isListening}
                />
                <p className="text-xs text-muted-foreground">
                  Higher = requires clearer speech to trigger
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Silence Threshold</Label>
                  <span className="text-sm text-muted-foreground">
                    {negativeSpeechThreshold.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[negativeSpeechThreshold]}
                  onValueChange={([v]) => setNegativeSpeechThreshold(v)}
                  min={0.1}
                  max={0.9}
                  step={0.05}
                  disabled={isListening}
                />
                <p className="text-xs text-muted-foreground">
                  Lower = detects silence more aggressively
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Min Speech Frames</Label>
                  <span className="text-sm text-muted-foreground">{minSpeechFrames}</span>
                </div>
                <Slider
                  value={[minSpeechFrames]}
                  onValueChange={([v]) => setMinSpeechFrames(v)}
                  min={1}
                  max={20}
                  step={1}
                  disabled={isListening}
                />
                <p className="text-xs text-muted-foreground">
                  Higher = requires longer speech to trigger
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Silence Delay (frames)</Label>
                  <span className="text-sm text-muted-foreground">{redemptionFrames}</span>
                </div>
                <Slider
                  value={[redemptionFrames]}
                  onValueChange={([v]) => setRedemptionFrames(v)}
                  min={1}
                  max={15}
                  step={1}
                  disabled={isListening}
                />
                <p className="text-xs text-muted-foreground">
                  Lower = faster speech end detection (each frame ~96ms)
                </p>
              </div>

              {isListening && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Stop listening to change settings
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Speech event log */}
      <SpeechLog events={events} />

      {/* Info card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="font-medium mb-1">How it works</h4>
              <p className="text-sm text-muted-foreground">
                Uses the Silero VAD model via ONNX Runtime to detect human speech in real-time.
                All processing happens locally in your browser.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Neural network-based detection</li>
                <li>Runs entirely in the browser</li>
                <li>Captures audio segments on speech end</li>
                <li>Adjustable sensitivity settings</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
