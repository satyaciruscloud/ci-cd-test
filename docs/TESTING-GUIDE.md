# Testing & CI/CD Guide

This guide explains the testing setup, how to run tests locally, and how GitHub Actions automates testing, linting, and building.

---

## Table of Contents

1. [Local Testing](#local-testing)
2. [GitHub Actions CI/CD](#github-actions-cicd)
3. [Test Files Structure](#test-files-structure)
4. [Writing Tests](#writing-tests)
5. [Coverage Reports](#coverage-reports)

---

## Local Testing

### Running Tests

Watch mode (recommended for development):
```bash
pnpm test
```

CI mode (single run with coverage):
```bash
pnpm test:ci
```

Run specific test file:
```bash
pnpm test -- use-vad.test.ts
```

Run tests matching pattern:
```bash
pnpm test -- --testNamePattern="should start listening"
```

### Test Configuration

Configuration files:
- `jest.config.ts` - Main Jest configuration
- `jest.setup.ts` - Test environment setup (mocks, globals)

Key settings:
- **Test Environment:** jsdom (browser-like environment)
- **Test Paths:** `__tests__` folders and `*.test.ts(x)` files
- **Coverage:** Collected from `hooks/`, `components/`, and `lib/` directories

---

## GitHub Actions CI/CD

The CI/CD pipeline runs automatically on:
- **Push** to `main` or `develop` branches
- **Pull requests** to `main` or `develop` branches

### Pipeline Stages

#### 1. **Test Job** (runs in parallel)
- Node.js 18.x and 20.x
- Runs: `pnpm test:ci`
- Uploads coverage to Codecov
- Must pass before Build

#### 2. **Lint Job** (runs in parallel)
- Node.js 20.x
- Runs: `pnpm lint`
- Checks code quality with ESLint
- Must pass before Build

#### 3. **Build Job** (depends on Test & Lint)
- Node.js 20.x
- Runs: `pnpm build`
- Verifies application builds successfully
- Archives build artifacts

### Workflow File

Location: `.github/workflows/ci.yml`

All steps are required to pass. If any job fails:
- Tests fail → Build won't run
- Linting fails → Build won't run
- Build fails → Deployment won't proceed

---

## Test Files Structure

```
project-root/
├── hooks/
│   ├── use-vad.ts
│   └── __tests__/
│       └── use-vad.test.ts
├── components/
│   ├── speech-log.tsx
│   ├── vad-demo.tsx
│   └── __tests__/
│       ├── speech-log.test.tsx
│       └── vad-demo.test.tsx
├── jest.config.ts
└── jest.setup.ts
```

### Naming Convention

- Test files: `[name].test.ts(x)` or `__tests__/[name].test.ts(x)`
- Describe blocks: Feature or component name
- Test cases: Clear, specific descriptions

---

## Writing Tests

### Hook Tests Example

```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { useVAD } from '@/hooks/use-vad'

describe('useVAD Hook', () => {
  it('should initialize with correct state', () => {
    const { result } = renderHook(() => useVAD())
    expect(result.current.isListening).toBe(false)
  })

  it('should handle async operations', async () => {
    const { result } = renderHook(() => useVAD())
    
    await act(async () => {
      await result.current.startListening()
    })
    
    expect(result.current.isListening).toBe(true)
  })
})
```

### Component Tests Example

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { SpeechLog } from '@/components/speech-log'

describe('SpeechLog Component', () => {
  it('should render events', () => {
    const events = [
      { id: '1', type: 'speech_start', timestamp: new Date() }
    ]
    
    render(<SpeechLog events={events} />)
    expect(screen.getByText(/Speech Started/i)).toBeInTheDocument()
  })

  it('should handle user interactions', () => {
    const events = [
      { id: '1', type: 'speech_end', timestamp: new Date(), audioData: new Float32Array([0.1]) }
    ]
    
    render(<SpeechLog events={events} />)
    const playButton = screen.getByTitle(/Play/)
    fireEvent.click(playButton)
    
    expect(screen.getByTitle(/Stop/)).toBeInTheDocument()
  })
})
```

### Testing Async Code

Use `act()` wrapper for state updates:
```typescript
await act(async () => {
  await result.current.startListening()
})
```

Use `waitFor()` for async assertions:
```typescript
await waitFor(() => {
  expect(result.current.isListening).toBe(true)
}, { timeout: 3000 })
```

---

## Coverage Reports

### Local Coverage

Generate coverage report:
```bash
pnpm test:ci
```

Output location: `coverage/`

View HTML report:
```bash
open coverage/lcov-report/index.html
```

### CI/CD Coverage

Coverage is automatically uploaded to **Codecov** after tests pass.

View coverage on Codecov dashboard: https://codecov.io

### Coverage Goals

Current targets:
- Statements: 80%+
- Branches: 75%+
- Functions: 80%+
- Lines: 80%+

---

## Mocked Modules

The following modules are mocked in `jest.setup.ts`:

| Module | Mock Purpose |
|--------|--------------|
| `next/navigation` | Router and pathname hooks |
| `window.matchMedia` | Media query detection |
| `AudioContext` | Web Audio API |
| `navigator.mediaDevices` | Microphone access |

To add custom mocks:
1. Edit `jest.setup.ts`
2. Add your mock definition
3. Clear cache: `pnpm test -- --clearCache`

---

## Common Issues

### "Cannot find module '@/...'"

Run: `pnpm test -- --clearCache`

### "AudioContext is not defined"

The mock is in `jest.setup.ts`. Verify it's imported in your test:
```typescript
// jest.setup.ts should be auto-loaded via jest.config.ts
```

### Tests hang/timeout

Use explicit timeout:
```bash
pnpm test -- --testTimeout=10000
```

### Coverage not generated

Ensure `test:ci` is used:
```bash
pnpm test:ci  # Generates coverage
pnpm test     # Watch mode, no coverage
```

---

## Best Practices

1. **Test behavior, not implementation**
   - ✅ "should play audio when button clicked"
   - ❌ "should call playAudio function"

2. **Use meaningful test descriptions**
   - ✅ `it('should stop listening when user clicks stop')`
   - ❌ `it('works')`

3. **Keep tests focused**
   - One test = one behavior
   - Use describe blocks to organize

4. **Mock external dependencies**
   - Media APIs (already mocked)
   - Network calls
   - Third-party libraries

5. **Test edge cases**
   - Empty states
   - Errors
   - Boundary values

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library Docs](https://testing-library.com/react)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Codecov Guide](https://docs.codecov.io/)
