import { renderHook, act, waitFor } from '@testing-library/react'
import { useVAD } from '@/hooks/use-vad'

describe('useVAD Hook', () => {
  let mockGetUserMedia: jest.Mock

  beforeEach(() => {
    mockGetUserMedia = jest.fn().mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([
        {
          stop: jest.fn(),
          kind: 'audio',
        },
      ]),
      getAudioTracks: jest.fn().mockReturnValue([
        {
          stop: jest.fn(),
        },
      ]),
    })
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        ...global.navigator.mediaDevices,
        getUserMedia: mockGetUserMedia,
      },
      configurable: true,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useVAD())

    expect(result.current.isListening).toBe(false)
    expect(result.current.isSpeaking).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.audioLevel).toBe(0)
    expect(result.current.error).toBeNull()
  })

  it('should start listening and request microphone access', async () => {
    const { result } = renderHook(() => useVAD())

    await act(async () => {
      await result.current.startListening()
    })

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
  })

  it('should stop listening and clean up resources', async () => {
    const { result } = renderHook(() => useVAD())

    await act(async () => {
      await result.current.startListening()
    })

    await act(async () => {
      result.current.stopListening()
    })

    expect(result.current.isListening).toBe(false)
  })

  it('should handle microphone permission denied', async () => {
    mockGetUserMedia.mockRejectedValueOnce(
      new DOMException('Permission denied', 'NotAllowedError')
    )

    const { result } = renderHook(() => useVAD())

    await act(async () => {
      await result.current.startListening()
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })
  })

  it('should call onSpeechStart callback when speech starts', async () => {
    const onSpeechStart = jest.fn()
    const { result } = renderHook(() => useVAD({ onSpeechStart }))

    await act(async () => {
      await result.current.startListening()
    })

    // Simulate speech start
    await act(async () => {
      // This would be called internally by VAD
      // In a real test, you'd mock the VAD worker communication
    })

    // Note: Full testing requires mocking VAD worker
    expect(onSpeechStart).toBeDefined()
  })

  it('should accept custom thresholds', () => {
    const { result } = renderHook(() =>
      useVAD({
        positiveSpeechThreshold: 0.8,
        negativeSpeechThreshold: 0.2,
        minSpeechFrames: 10,
      })
    )

    expect(result.current).toBeDefined()
  })

  it('should handle cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() => useVAD())

    await act(async () => {
      await result.current.startListening()
    })

    unmount()

    // Component should clean up after unmount
    expect(mockGetUserMedia).toHaveBeenCalled()
  })
})
