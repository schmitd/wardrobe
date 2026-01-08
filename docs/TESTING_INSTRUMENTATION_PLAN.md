# Testing & Instrumentation Implementation Plan

## Overview

This document outlines the comprehensive plan to add **testing**, **instrumentation**, and **wide logging** to the Wardrobe AI application. The plan covers:

1. **Testing Framework** - Unit, integration, and E2E testing
2. **Observability Stack** - OpenTelemetry + Axiom integration
3. **Structured Logging** - Wide logging with context propagation
4. **Performance Monitoring** - Tracing for AI operations and database queries

---

## 1. Testing Framework

### 1.1 Recommended Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit Tests | **Vitest** | Fast, ESM-native, TypeScript-first |
| Integration Tests | **Vitest + Supertest** | API route testing |
| E2E Tests | **Playwright** | Browser automation, visual regression |
| Mocking | **MSW (Mock Service Worker)** | API mocking for external services |

### 1.2 Test Coverage Targets

```
├── src/
│   ├── lib/                  # Unit tests
│   │   ├── embeddings.ts     → embeddings.test.ts
│   │   ├── arcjet.ts         → arcjet.test.ts
│   │   └── supabase.ts       → supabase.test.ts
│   │
│   ├── app/
│   │   └── actions.ts        → actions.test.ts (integration)
│   │
│   └── components/           # Component tests
│       ├── WardrobeGrid.tsx  → WardrobeGrid.test.tsx
│       └── CompatibilityChecker.tsx → CompatibilityChecker.test.tsx
│
└── e2e/                      # E2E tests
    ├── upload-item.spec.ts
    ├── check-compatibility.spec.ts
    └── auth-flow.spec.ts
```

### 1.3 Implementation Tasks

- [ ] **Phase 1: Setup (Day 1)**
  - [ ] Install Vitest, @testing-library/react, MSW, Playwright
  - [ ] Configure `vitest.config.ts` with Next.js support
  - [ ] Setup MSW handlers for Gemini, Supabase, Clerk APIs
  - [ ] Create test utilities and fixtures

- [ ] **Phase 2: Unit Tests (Days 2-3)**
  - [ ] `lib/embeddings.ts` - Test centroid calculation, projection
  - [ ] `lib/supabase.ts` - Test authenticated client creation
  - [ ] Mocked Gemini API responses

- [ ] **Phase 3: Integration Tests (Days 4-5)**
  - [ ] `app/actions.ts` - Test `addItems()` and `checkCompatibility()`
  - [ ] Rate limiting behavior validation
  - [ ] Error handling paths

- [ ] **Phase 4: E2E Tests (Days 6-7)**
  - [ ] Full upload → analysis → view flow
  - [ ] Compatibility check flow
  - [ ] Authentication flows

---

## 2. Observability Stack: OpenTelemetry + Axiom

### 2.1 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Application                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │  Next.js    │  │  Server     │  │  External Services       │   │
│  │  Pages/API  │  │  Actions    │  │  (Gemini, Supabase,     │   │
│  │             │  │             │  │   Clerk, UploadThing)   │   │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘   │
│         │                │                      │                 │
│  ┌──────▼──────────────────────────────────────▼─────────────┐   │
│  │            OpenTelemetry SDK (Auto + Manual)               │   │
│  │   Traces ─────────────────┐ Logs ─────────────────────┐    │   │
│  │   Metrics ────────────────┤                           │    │   │
│  └───────────────────────────┼───────────────────────────┼────┘   │
│                              │                           │        │
└──────────────────────────────┼───────────────────────────┼────────┘
                               │                           │
                    ┌──────────▼───────────────────────────▼────────┐
                    │              OTLP Exporter                     │
                    └──────────────────────┬────────────────────────┘
                                           │
                    ┌──────────────────────▼────────────────────────┐
                    │                  Axiom                         │
                    │   ┌─────────────────────────────────────────┐ │
                    │   │  Traces Dataset: wardrobe-traces         │ │
                    │   │  Logs Dataset: wardrobe-logs             │ │
                    │   │  Dashboards & Alerts                     │ │
                    │   └─────────────────────────────────────────┘ │
                    └───────────────────────────────────────────────┘
```

### 2.2 OpenTelemetry Packages

```bash
# Core OTEL packages
bun add @opentelemetry/api \
        @opentelemetry/sdk-node \
        @opentelemetry/sdk-trace-node \
        @opentelemetry/exporter-trace-otlp-http \
        @opentelemetry/exporter-logs-otlp-http \
        @opentelemetry/instrumentation-http \
        @opentelemetry/instrumentation-fetch \
        @opentelemetry/resources \
        @opentelemetry/semantic-conventions

# Axiom integration (optional - can use raw OTLP)
bun add @axiomhq/js
```

### 2.3 Axiom Setup

1. **Create Axiom Account** at https://axiom.co
2. **Create Datasets**:
   - `wardrobe-traces` - For distributed traces
   - `wardrobe-logs` - For structured logs
3. **Create API Token** with ingest permissions
4. **Environment Variables**:

```env
# Add to .env.local
AXIOM_DATASET=wardrobe-logs
AXIOM_TOKEN=xaat-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AXIOM_ORG_ID=your-org-id

# OpenTelemetry config
OTEL_SERVICE_NAME=wardrobe-ai
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.axiom.co
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer xaat-xxx,X-Axiom-Dataset=wardrobe-traces
```

### 2.4 Implementation Files

```
src/
├── lib/
│   ├── telemetry/
│   │   ├── index.ts           # Main OTEL setup & initialization
│   │   ├── tracer.ts          # Tracer instance & span helpers
│   │   ├── logger.ts          # Structured logger with OTEL context
│   │   ├── metrics.ts         # Custom metrics (optional)
│   │   └── axiom.ts           # Axiom client wrapper
│   └── ...
├── instrumentation.ts         # Next.js instrumentation hook
└── ...
```

---

## 3. Structured Wide Logging

### 3.1 Logging Philosophy

**Wide logging** means including rich context in every log entry:

```typescript
// ❌ Narrow logging (bad)
console.log("Processing item");

// ✅ Wide logging (good)
logger.info("Processing item", {
  traceId: span.spanContext().traceId,
  userId: "user_123",
  operation: "addItems",
  imageCount: 3,
  source: "uploadthing",
  timestamp: Date.now(),
  environment: "production"
});
```

### 3.2 Log Schema

Every log entry should include:

```typescript
interface LogEntry {
  // Identity
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  
  // Trace correlation
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  
  // Request context
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  
  // Business context
  operation?: string;
  
  // Performance
  durationMs?: number;
  
  // Error details
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  
  // Custom attributes
  attributes?: Record<string, unknown>;
}
```

### 3.3 Logger Implementation

```typescript
// src/lib/telemetry/logger.ts
import { trace, context } from '@opentelemetry/api';
import { Axiom } from '@axiomhq/js';

const axiom = new Axiom({
  token: process.env.AXIOM_TOKEN!,
  orgId: process.env.AXIOM_ORG_ID,
});

export function createLogger(module: string) {
  return {
    info: (message: string, attrs?: Record<string, unknown>) => 
      log('info', module, message, attrs),
    warn: (message: string, attrs?: Record<string, unknown>) => 
      log('warn', module, message, attrs),
    error: (message: string, error?: Error, attrs?: Record<string, unknown>) => 
      log('error', module, message, { 
        ...attrs, 
        error: error ? { 
          name: error.name, 
          message: error.message, 
          stack: error.stack 
        } : undefined 
      }),
    debug: (message: string, attrs?: Record<string, unknown>) => 
      log('debug', module, message, attrs),
  };
}

function log(
  level: string, 
  module: string, 
  message: string, 
  attrs?: Record<string, unknown>
) {
  const span = trace.getActiveSpan();
  const spanContext = span?.spanContext();
  
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    traceId: spanContext?.traceId,
    spanId: spanContext?.spanId,
    environment: process.env.NODE_ENV,
    ...attrs,
  };
  
  // Console output for development
  if (process.env.NODE_ENV === 'development') {
    console.log(JSON.stringify(entry, null, 2));
  }
  
  // Send to Axiom
  axiom.ingest(process.env.AXIOM_DATASET!, [entry]);
}
```

---

## 4. Instrumentation Points

### 4.1 Critical Paths to Instrument

| Path | Type | Metrics |
|------|------|---------|
| `addItems()` | Trace + Logs | Duration, image count, success/fail |
| `checkCompatibility()` | Trace + Logs | Duration, wardrobe size, score |
| Gemini API calls | Child Spans | Latency, token usage, model |
| Supabase queries | Child Spans | Query type, rows affected |
| Image fetch | Child Spans | URL, size, duration |
| Auth checks | Logs | userId, passed/failed |

### 4.2 Example Instrumented Action

```typescript
// src/app/actions.ts (instrumented version)
import { trace } from '@opentelemetry/api';
import { createLogger } from '@/lib/telemetry/logger';

const logger = createLogger('actions');
const tracer = trace.getTracer('wardrobe-actions');

export async function addItems(imageUrls: string[]) {
  return tracer.startActiveSpan('addItems', async (span) => {
    span.setAttributes({
      'wardrobe.image_count': imageUrls.length,
      'user.id': userId,
    });
    
    logger.info('Starting batch item addition', {
      operation: 'addItems',
      imageCount: imageUrls.length,
    });
    
    try {
      // ... implementation with child spans for each step
      
      const result = await tracer.startActiveSpan('gemini.analyze', async (childSpan) => {
        childSpan.setAttributes({ 'ai.model': 'gemini-2.5-flash-lite' });
        // ... Gemini call
        return result;
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      logger.info('Batch addition completed', {
        operation: 'addItems',
        successCount: cleanItemsToInsert.length,
        failedCount: failedUrls.length,
      });
      
      return { success: true, ... };
      
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      logger.error('Batch addition failed', error, { operation: 'addItems' });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

---

## 5. Implementation Timeline

### Week 1: Foundation

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Setup test infrastructure | `vitest.config.ts`, MSW handlers |
| 2-3 | Write unit tests | `*.test.ts` for lib modules |
| 4-5 | Setup OpenTelemetry | `src/lib/telemetry/*`, `instrumentation.ts` |

### Week 2: Integration

| Day | Task | Deliverable |
|-----|------|-------------|
| 6 | Axiom integration | Logs flowing to Axiom |
| 7 | Integration tests | `actions.test.ts` |
| 8-9 | Instrument actions | Traced `addItems`, `checkCompatibility` |
| 10 | E2E test setup | Playwright config, first tests |

### Week 3: Polish

| Day | Task | Deliverable |
|-----|------|-------------|
| 11 | Complete E2E tests | Full coverage of critical flows |
| 12 | Axiom dashboards | Monitoring dashboard |
| 13 | Alerting | Error rate, latency alerts |
| 14 | Documentation | Updated README, runbooks |

---

## 6. Package Installation Commands

```bash
# Testing
bun add -d vitest @vitest/ui @testing-library/react @testing-library/jest-dom \
         jsdom msw playwright @playwright/test

# OpenTelemetry
bun add @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/sdk-trace-node \
        @opentelemetry/exporter-trace-otlp-http @opentelemetry/instrumentation-http \
        @opentelemetry/instrumentation-fetch @opentelemetry/resources \
        @opentelemetry/semantic-conventions

# Axiom
bun add @axiomhq/js
```

---

## 7. Configuration Files to Create

### 7.1 `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**', 'src/app/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 7.2 `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
  webServer: {
    command: 'bun dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 7.3 `src/instrumentation.ts` (Next.js hook)

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/telemetry');
  }
}
```

---

## 8. Environment Variables Checklist

Add to `.env.local`:

```env
# Axiom (Observability)
AXIOM_DATASET=wardrobe-logs
AXIOM_TOKEN=xaat-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AXIOM_ORG_ID=your-org-id

# OpenTelemetry
OTEL_SERVICE_NAME=wardrobe-ai
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.axiom.co
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer ${AXIOM_TOKEN},X-Axiom-Dataset=wardrobe-traces

# Optional: Enable debug logging
OTEL_LOG_LEVEL=info
```

---

## 9. Success Criteria

- [ ] **Testing**: ≥80% code coverage on critical paths
- [ ] **Traces**: All server actions traced with child spans
- [ ] **Logs**: Every action logs start/success/failure
- [ ] **Latency**: P95 latency visible in Axiom dashboard
- [ ] **Errors**: Error rate alerts configured
- [ ] **Correlation**: Logs can be filtered by traceId

---

## 10. Next Steps

1. **Review this plan** - Confirm scope and timeline
2. **Start with testing setup** - This provides the safety net
3. **Layer in observability** - Add OTEL after tests exist
4. **Iterate on dashboards** - Build as you instrument

---

*Created: 2026-01-05*
*Branch: feature/testing-instrumentation-logging*
