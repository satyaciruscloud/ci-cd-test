# Testing & CI/CD Setup

## Quick Start

### Run Tests Locally
```bash
# Watch mode (re-runs on file changes)
pnpm test

# Single run with coverage
pnpm test:ci

# Run specific test file
pnpm test speech-log
```

### Run Linting
```bash
pnpm lint
```

### Build Project
```bash
pnpm build
```

## Test Coverage

**All 32 tests passing ✓**

```
Test Suites: 3 passed, 3 total
Tests:       32 passed, 32 total
Snapshots:   0 total
```

### Coverage Breakdown

| Module | Lines | Branches | Functions |
|--------|-------|----------|-----------|
| **components/speech-log.tsx** | 100% | 100% | 100% |
| **hooks/use-vad.ts** | 78.18% | 65% | 25% |
| **lib/utils.ts** | 100% | 100% | 100% |

## Test Files Organization

```
test/
├── hooks/
│   └── use-vad.test.ts         (9 tests)
└── components/
    ├── speech-log.test.tsx     (10 tests)
    └── vad-demo.test.tsx       (13 tests)
```

## What We're Testing

### 1. **Hooks** (`use-vad.test.ts`)
- ✅ VAD initialization and configuration
- ✅ Microphone permission handling
- ✅ State management (isListening, isSpeaking, audioLevel)
- ✅ Event callbacks (onSpeechStart, onSpeechEnd, onVADMisfire)
- ✅ Error handling

### 2. **Components** 

#### Speech Log (`speech-log.test.tsx`)
- ✅ Renders event data correctly
- ✅ Displays different event types
- ✅ Shows duration formatting
- ✅ Play/download buttons for audio
- ✅ Empty state handling

#### VAD Demo (`vad-demo.test.tsx`)
- ✅ Component rendering
- ✅ Button presence and interactions
- ✅ Settings sliders
- ✅ Real-time audio visualization
- ✅ State management

## GitHub Actions CI/CD

Automatic tests run on every push and pull request.

### Workflow Steps

1. **Install Dependencies** - `pnpm install`
2. **Run Tests** - `pnpm test:ci`
3. **Run Linting** - `pnpm lint`
4. **Build Application** - `pnpm build`
5. **Generate Coverage** - Coverage report created

### Configuration

**File:** `.github/workflows/ci.yml`

Triggers on:
- Push to `main` branch
- Pull requests
- Manual dispatch (Actions tab)

## Writing New Tests

### Test Template

```typescript
import { render, screen } from '@testing-library/react'
import { MyComponent } from '@/components/my-component'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText(/hello/i)).toBeInTheDocument()
  })

  it('should handle user interaction', () => {
    render(<MyComponent />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(screen.getByText(/clicked/i)).toBeInTheDocument()
  })
})
```

### Best Practices

✅ **DO:**
- Test user behavior, not implementation
- Use semantic queries (getByRole, getByText)
- Mock external dependencies
- Name tests descriptively

❌ **DON'T:**
- Test internal state directly
- Rely on CSS classes or IDs
- Over-mock components
- Write tests that are too specific

## Documentation

- **Component Testing Guide** - `docs/COMPONENT-TESTING-GUIDE.md`
- **CI/CD Setup Details** - `docs/CI-CD-SETUP.md`
- **Testing Summary** - `COMPONENT-TESTING-SUMMARY.md`

## Debugging Tests

### View Component Output
```typescript
const { debug } = render(<Component />)
debug() // prints the DOM
```

### Interactive Testing
```bash
pnpm test --testNamePattern="my test"
```

### Coverage Report
```bash
pnpm test:ci
# Open coverage/lcov-report/index.html in browser
```

## Troubleshooting

### Tests timing out
```bash
# Increase timeout
jest.setTimeout(10000)
```

### Mock not working
```bash
# Clear all mocks before each test
beforeEach(() => jest.clearAllMocks())
```

### Element not found
- Use `screen.debug()` to see rendered output
- Check if element is hidden/conditional
- Verify element is rendered before querying

## Next Steps

1. **Expand coverage** - Add more component tests
2. **E2E testing** - Add Cypress/Playwright tests
3. **Visual testing** - Screenshot-based regression testing
4. **Performance monitoring** - Track render times
5. **Accessibility testing** - Verify ARIA and keyboard navigation
