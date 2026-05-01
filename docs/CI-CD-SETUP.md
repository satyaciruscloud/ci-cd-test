# CI/CD Setup Documentation

This document explains the complete testing and GitHub Actions CI/CD pipeline setup for this project.

---

## Quick Start

### Run Tests Locally
```bash
# Watch mode (interactive, recommended for development)
pnpm test

# CI mode with coverage report
pnpm test:ci
```

### Run Linting
```bash
pnpm lint
```

### Build Application
```bash
pnpm build
```

---

## What's Installed

### Testing Dependencies
- **jest** - Test runner
- **@testing-library/react** - React component testing utilities
- **@testing-library/jest-dom** - DOM matchers for Jest
- **@testing-library/user-event** - User interaction simulation
- **jest-environment-jsdom** - Browser-like test environment

### Configuration Files
- `jest.config.ts` - Jest configuration
- `jest.setup.ts` - Test environment setup with mocks
- `.github/workflows/ci.yml` - GitHub Actions CI/CD workflow

---

## Test Structure

```
project/
├── hooks/
│   ├── use-vad.ts
│   └── __tests__/
│       └── use-vad.test.ts
├── components/
│   ├── speech-log.tsx
│   └── __tests__/
│       └── speech-log.test.tsx
├── jest.config.ts
├── jest.setup.ts
└── .github/
    └── workflows/
        └── ci.yml
```

### Test Files Included
- `hooks/__tests__/use-vad.test.ts` - VAD hook tests
- `components/__tests__/speech-log.test.tsx` - Speech log component tests

---

## GitHub Actions Workflow

Location: `.github/workflows/ci.yml`

### Triggers
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

### Pipeline Jobs

#### 1. Test Job
- Runs on Node.js 18.x and 20.x
- Executes: `pnpm test:ci`
- Uploads coverage to Codecov
- Status: Required to pass

#### 2. Lint Job
- Runs on Node.js 20.x
- Executes: `pnpm lint`
- Checks ESLint rules
- Status: Required to pass

#### 3. Build Job
- Runs on Node.js 20.x
- Depends on: Test & Lint jobs
- Executes: `pnpm build`
- Verifies production build succeeds
- Archives `.next` artifacts
- Status: Required to pass

### Job Dependencies
```
Test Job ──┐
           ├──> Build Job (only runs if Test & Lint pass)
Lint Job ──┘
```

If any job fails, subsequent jobs are skipped.

---

## Coverage Report

### Generate Locally
```bash
pnpm test:ci
```

View HTML report:
```bash
open coverage/lcov-report/index.html
```

### CI/CD Coverage
- Automatically uploaded to Codecov after tests pass
- View at: https://codecov.io (requires account)
- Badge can be added to README

### Coverage Targets
- Statements: 80%+
- Branches: 75%+
- Functions: 80%+
- Lines: 80%+

Current coverage:
- `speech-log.tsx`: 72.96% statements
- `use-vad.ts`: 78.18% statements

---

## Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm test` | Run tests in watch mode |
| `pnpm test:ci` | Run tests with coverage (CI mode) |
| `pnpm lint` | Check code quality |
| `pnpm lint --fix` | Auto-fix linting issues |
| `pnpm build` | Build for production |
| `pnpm dev` | Start development server |

---

## Debugging Tests

### Run Specific Test
```bash
pnpm test -- use-vad.test.ts
```

### Run Tests Matching Pattern
```bash
pnpm test -- --testNamePattern="should start listening"
```

### Clear Jest Cache
```bash
pnpm test -- --clearCache
```

### Verbose Output
```bash
pnpm test -- --verbose
```

---

## Mocked Modules

The following are mocked in `jest.setup.ts`:

| Module | Purpose | Mock |
|--------|---------|------|
| `next/navigation` | Router hooks | useRouter, usePathname |
| `window.matchMedia` | Media queries | Media query detection |
| `AudioContext` | Web Audio API | Audio buffer creation, playback |
| `navigator.mediaDevices` | Microphone access | getUserMedia, enumerateDevices |

---

## Deployment with GitHub Actions

The CI/CD pipeline is designed to prevent broken code from merging:

1. **PR opens** → All checks run
2. **Checks fail** → PR blocks merge
3. **Checks pass** → PR can be merged
4. **Code merges** → Actions run again on `main`

### Optional: Auto-Deploy on Main

Uncomment the deployment job in `.github/workflows/ci.yml` and set these secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

---

## Troubleshooting

### Tests Fail Locally but Pass in CI
- Clear jest cache: `pnpm test -- --clearCache`
- Delete node_modules: `rm -rf node_modules && pnpm install`

### Coverage Not Generated
- Use `pnpm test:ci` (not `pnpm test`)
- Check `coverage/` directory exists

### Build Fails in GitHub Actions
- View workflow logs: Go to Actions tab in GitHub
- Check Node version compatibility
- Verify all dependencies are installed

### Linting Issues
- Auto-fix: `pnpm lint --fix`
- Manual review: `pnpm lint`

---

## Next Steps

1. **Connect GitHub**: Set project in Vercel
2. **View Workflows**: Go to Actions tab after first push
3. **Monitor Coverage**: Set up Codecov integration
4. **Add More Tests**: Create tests for new features
5. **Enable Deployments**: Uncomment deploy job when ready

---

## Resources

- [Jest Docs](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [GitHub Actions](https://github.com/features/actions)
- [Codecov](https://codecov.io/)
