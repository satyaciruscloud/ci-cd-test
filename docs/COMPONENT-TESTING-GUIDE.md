# React Component Testing Guide

## Overview

React Testing Library allows you to test components the way users interact with them - focusing on behavior rather than implementation details. This means testing **UI + Logic together**.

## Key Testing Concepts

### 1. Rendering Tests
Test that components render correctly with given props.

```typescript
it('should render with event data', () => {
  render(<SpeechLog events={mockEvents} />)
  expect(screen.getByText(/Speech Started/i)).toBeInTheDocument()
})
```

### 2. User Interaction Tests
Test button clicks, form inputs, and user actions.

```typescript
it('should toggle play button on click', () => {
  render(<SpeechLog events={mockEvents} />)
  const playButton = screen.getByTitle(/Play/)
  
  fireEvent.click(playButton)
  // Verify that state changed or UI updated
})
```

### 3. Conditional Rendering Tests
Test different UI based on component state.

```typescript
it('should show empty state when no events', () => {
  render(<SpeechLog events={[]} />)
  const items = screen.queryAllByRole('button')
  expect(items.length).toBe(0)
})

it('should show play button only for audio events', () => {
  render(<SpeechLog events={eventsWithAudio} />)
  expect(screen.getByTitle(/Play/)).toBeInTheDocument()
})
```

### 4. Logic Tests
Test component business logic and data transformations.

```typescript
it('should format duration correctly', () => {
  const event = {
    id: '1',
    type: 'speech_end',
    timestamp: new Date(),
    duration: 1500, // 1.5 seconds
  }
  
  render(<SpeechLog events={[event]} />)
  expect(screen.getByText(/1.50s/)).toBeInTheDocument()
})
```

### 5. Async Tests
Test components with async operations (API calls, state updates).

```typescript
it('should handle async audio playback', async () => {
  render(<SpeechLog events={mockEvents} />)
  const playButton = screen.getByTitle(/Play/)
  
  fireEvent.click(playButton)
  
  // Wait for state to update
  await waitFor(() => {
    expect(screen.getByTitle(/Stop/)).toBeInTheDocument()
  })
})
```

## Testing Best Practices

### ✅ DO's

1. **Test user behavior, not implementation**
   ```typescript
   // GOOD - tests what user sees
   expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
   
   // BAD - tests implementation detail
   expect(component.state.isPlaying).toBe(true)
   ```

2. **Use semantic queries**
   ```typescript
   // GOOD - prioritized
   screen.getByRole('button')
   screen.getByText()
   screen.getByPlaceholderText()
   
   // AVOID - implementation detail
   screen.getByTestId()
   ```

3. **Mock external dependencies**
   ```typescript
   jest.mock('next/navigation')
   global.AudioContext = jest.fn(...)
   ```

4. **Use screen instead of container**
   ```typescript
   // GOOD
   expect(screen.getByText(/Speech/)).toBeInTheDocument()
   
   // AVOID
   expect(container.querySelector('.speech')).toBeInTheDocument()
   ```

### ❌ DON'Ts

1. **Don't test internal state directly**
   ```typescript
   // BAD
   expect(component.state.audioLevel).toBe(0.5)
   ```

2. **Don't rely on implementation details**
   ```typescript
   // BAD - if className changes, test breaks
   expect(container.querySelector('.play-btn')).toBeInTheDocument()
   ```

3. **Don't over-mock**
   ```typescript
   // Only mock what you need to test the component
   ```

## Advanced Testing Patterns

### Testing with Hooks

```typescript
import { renderHook, act } from '@testing-library/react'

it('should initialize VAD hook correctly', () => {
  const { result } = renderHook(() => useVAD())
  
  expect(result.current.isListening).toBe(false)
})

it('should update state when listening', async () => {
  const { result } = renderHook(() => useVAD())
  
  await act(async () => {
    await result.current.startListening()
  })
  
  expect(result.current.isListening).toBe(true)
})
```

### Testing Events and Callbacks

```typescript
it('should call onSpeechEnd callback with audio data', async () => {
  const mockOnSpeechEnd = jest.fn()
  
  render(
    <SpeechLog 
      events={mockEvents} 
      onSpeechEnd={mockOnSpeechEnd}
    />
  )
  
  // Simulate speech end
  fireEvent.click(screen.getByTitle(/Play/))
  
  await waitFor(() => {
    expect(mockOnSpeechEnd).toHaveBeenCalled()
  })
})
```

### Testing Error States

```typescript
it('should handle microphone permission denied', async () => {
  global.navigator.mediaDevices.getUserMedia = jest.fn(
    () => Promise.reject(new Error('Permission denied'))
  )
  
  render(<VADDemo />)
  
  await waitFor(() => {
    expect(screen.getByText(/Permission denied/)).toBeInTheDocument()
  })
})
```

### Testing with Data Providers

```typescript
it('should render with multiple event types', () => {
  const eventTypes = [
    { type: 'speech_start', id: '1' },
    { type: 'speech_end', id: '2' },
    { type: 'misfire', id: '3' },
  ]
  
  const events = eventTypes.map(e => ({
    ...e,
    timestamp: new Date(),
  }))
  
  render(<SpeechLog events={events} />)
  
  expect(screen.getByText(/Speech Started/)).toBeInTheDocument()
  expect(screen.getByText(/Speech Ended/)).toBeInTheDocument()
})
```

## Coverage Goals

| Category | Target | Why |
|----------|--------|-----|
| Critical paths | 100% | User workflows must work |
| Components | 80%+ | UI logic is important |
| Hooks | 90%+ | Core business logic |
| Utilities | 100% | Pure functions must be predictable |
| Pages | 50%+ | Often just composition |

Check coverage with:
```bash
pnpm test:ci
# Coverage report in ./coverage/
```

## Debugging Tests

### View rendered output
```typescript
it('should render correctly', () => {
  const { debug } = render(<SpeechLog events={mockEvents} />)
  debug() // prints the DOM
})
```

### Log queries
```typescript
it('should find elements', () => {
  render(<SpeechLog events={mockEvents} />)
  
  // See all available queries
  screen.logTestingPlaygroundURL()
})
```

### Use Testing Playground
```typescript
it('should render', () => {
  render(<SpeechLog events={mockEvents} />)
  
  // Copy the URL from console output
  // Paste in testing-playground.com to debug selectors
})
```

## Running Tests

```bash
# Watch mode (re-run on file changes)
pnpm test

# CI mode with coverage
pnpm test:ci

# Run specific test file
pnpm test speech-log.test

# Run tests matching pattern
pnpm test --testNamePattern="should render"

# Update snapshots
pnpm test -u
```

## Resources

- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Docs](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
