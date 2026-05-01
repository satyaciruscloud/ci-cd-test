"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface VADVisualizerProps {
  isListening: boolean
  isSpeaking: boolean
  audioLevel: number
  className?: string
}

export function VADVisualizer({
  isListening,
  isSpeaking,
  audioLevel,
  className,
}: VADVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const barsRef = useRef<number[]>(Array(32).fill(0))
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const animate = () => {
      const width = canvas.width
      const height = canvas.height
      const barCount = 32
      const barWidth = width / barCount - 2
      const maxBarHeight = height * 0.8

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Update bars with smooth interpolation
      for (let i = 0; i < barCount; i++) {
        const targetHeight = isListening
          ? (isSpeaking
              ? Math.random() * audioLevel * maxBarHeight + maxBarHeight * 0.2
              : Math.random() * audioLevel * maxBarHeight * 0.3 + 4)
          : 4

        // Smooth interpolation
        barsRef.current[i] += (targetHeight - barsRef.current[i]) * 0.15
      }

      // Draw bars
      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + 2) + 1
        const barHeight = Math.max(4, barsRef.current[i])
        const y = (height - barHeight) / 2

        // Create gradient based on state
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight)
        
        if (isSpeaking) {
          gradient.addColorStop(0, "#22c55e")
          gradient.addColorStop(0.5, "#16a34a")
          gradient.addColorStop(1, "#15803d")
        } else if (isListening) {
          gradient.addColorStop(0, "#3b82f6")
          gradient.addColorStop(0.5, "#2563eb")
          gradient.addColorStop(1, "#1d4ed8")
        } else {
          gradient.addColorStop(0, "#6b7280")
          gradient.addColorStop(1, "#4b5563")
        }

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, 2)
        ctx.fill()
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isListening, isSpeaking, audioLevel])

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={100}
      className={cn("w-full max-w-md h-24", className)}
    />
  )
}
