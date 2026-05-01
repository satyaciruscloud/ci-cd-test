import '@testing-library/jest-dom'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  usePathname() {
    return ''
  },
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock AudioContext with proper audio buffer support
const mockAudioBuffer = {
  getChannelData: jest.fn(() => new Float32Array(1000)),
  length: 1000,
  duration: 0.1,
  sampleRate: 16000,
}

const mockAudioContext = {
  createBuffer: jest.fn(() => mockAudioBuffer),
  createBufferSource: jest.fn(() => ({
    buffer: null,
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    onended: null,
  })),
  destination: {},
  close: jest.fn(),
  resume: jest.fn(),
}

global.AudioContext = jest.fn(() => mockAudioContext) as any

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(),
    enumerateDevices: jest.fn(),
  },
  configurable: true,
})


