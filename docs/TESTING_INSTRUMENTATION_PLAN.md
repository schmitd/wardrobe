# Testing & Instrumentation Implementation Plan (Redesigned with Effect)

## Overview

This document outlines the comprehensive plan to add **testing**, **instrumentation**, and **wide logging** to the Wardrobe AI application, leveraging the **Effect** library.

**Why Effect?**
Effect provides a robust runtime for managing side effects, concurrency, and observability. By using Effect, we get:
- **Built-in structured logging**: Low-overhead logging that integrates with context.
- **First-class Tracing**: `Effect.withSpan` automatically creates traces compatible with OpenTelemetry.
- **Dependency Injection**: `Layer`s allow us to mock services easily for testing.
- **Error Management**: Typed errors and robust failure handling.

The plan covers:
1. **Testing Framework** - Vitest + Effect integration.
2. **Observability Stack** - Effect Telemetry -> OpenTelemetry -> Axiom.
3. **Refactoring** - Converting core logic to Effect Services/Layers.

---

## 1. Observability Stack: Effect + OpenTelemetry + Axiom

### 1.1 Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Effect Application                           │
│                                                                      │
│    ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐    │
│    │  Next.js     │    │   Effect     │    │  Effect Services   │    │
│    │  Actions/API │ ─> │   Runtime    │ ─> │ (AI, DB, etc.)     │    │
│    │ (Entrypoint) │    │              │    │                    │    │
│    └──────────────┘    └──────┬───────┘    └─────────┬──────────┘    │
│                               │                      │               │
│                        (Auto-Instrumentation)        │               │
│                               │                      │               │
│    ┌──────────────────────────▼──────────────────────▼──────────┐    │
│    │                   Effect Telemetry Layer                   │    │
│    │     (NodeSdk.layer / OTLPTraceExporter / OTLPLogExporter)  │    │
│    └──────────────────────────┬─────────────────────────────────┘    │
│                               │                                      │
│                     OTLP (HTTP/Protobuf)                             │
│                               │                                      │
│                   ┌───────────▼────────────┐                         │
│                   │        Axiom           │                         │
│                   └────────────────────────┘                         │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 Dependencies

```bash
bun add effect @effect/opentelemetry \
        @opentelemetry/api \
        @opentelemetry/sdk-node \
        @opentelemetry/sdk-trace-node \
        @opentelemetry/sdk-metrics \
        @opentelemetry/resources \
        @opentelemetry/semantic-conventions \
        @opentelemetry/exporter-trace-otlp-http \
        @opentelemetry/exporter-metrics-otlp-http \
        @opentelemetry/exporter-logs-otlp-http \
        @opentelemetry/auto-instrumentations-node
```

### 1.3 Effect Runtime Configuration

We will create a global `NodeSdkLive` layer that configures OpenTelemetry to export to Axiom.

```typescript
// src/lib/effect-runtime.ts (Concept)

import { NodeSdk } from "@effect/opentelemetry"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { Resource } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { Effect, Layer } from "effect"

// Define the tracer layer
const TracerLive = NodeSdk.layer(() => ({
  resource: { serviceName: "wardrobe-ai" },
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: "https://api.axiom.co/v1/traces",
      headers: {
        Authorization: `Bearer ${process.env.AXIOM_TOKEN}`,
        "X-Axiom-Dataset": process.env.AXIOM_DATASET,
      },
    })
  ),
}))

export const RuntimeLive = TracerLive
```

---

## 2. Structured Logging with Effect

Effect's `Effect.log` functions automatically include the current fiber context and span information.

### 2.1 Logging Pattern

```typescript
// Old
console.log("Processing item", { userId });

// New (Effect)
yield* Effect.logInfo("Processing item").pipe(
  Effect.annotateLogs({ userId: userId })
)
```

### 2.2 Error Handling

Effect treats errors as values.

```typescript
// Catching and logging
yield* Effect.tryPromise(() => db.query(...)).pipe(
  Effect.catchAll(err => 
    Effect.logError("Database query failed").pipe(
      Effect.annotateLogs({ error: err.message }),
      Effect.fail(err) // Re-throw or handle
    )
  )
)
```

---

## 3. Refactoring Codebase to Effect Services

To fully utilize Effect, we will refactor core logic (`addItems`, `checkCompatibility`) into Effect workflows.

### 3.1 Services as Layers

We will wrap external clients (Supabase, Gemini) in Effect Services.

**Example: Gemini Service**

```typescript
// src/services/GeminiService.ts
import { Effect, Context, Layer } from "effect"
import { GoogleGenerativeAI } from "@google/generative-ai"

export class GeminiError extends Error {
  readonly _tag = "GeminiError"
}

export interface GeminiService {
  readonly generateContent: (prompt: string) => Effect.Effect<string, GeminiError>
}

export const GeminiService = Context.GenericTag<GeminiService>("GeminiService")

export const GeminiLive = Layer.effect(
  GeminiService,
  Effect.gen(function* () {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" })

    return {
      generateContent: (prompt) =>
        Effect.tryPromise({
          try: () => model.generateContent(prompt),
          catch: (e) => new GeminiError({ cause: e }),
        }).pipe(
          Effect.map(res => res.response.text()),
          Effect.withSpan("gemini.generate_content") // Auto-tracing
        )
    }
  })
)
```

### 3.2 Instrumented Server Actions

We will use a helper to run Effect programs inside Next.js Server Actions.

```typescript
// src/lib/run-effect.ts
import { Effect, ManagedRuntime } from "effect"
import { RuntimeLive } from "./effect-runtime"

export const runtime = ManagedRuntime.make(RuntimeLive)

export const runServerAction = <A, E>(effect: Effect.Effect<A, E>) => 
  runtime.runPromise(effect)
```

```typescript
// src/app/actions.ts (Refactored)
import { Effect } from "effect"
import { runServerAction } from "@/lib/run-effect"
import { GeminiService } from "@/services/GeminiService"
import { SupabaseService } from "@/services/SupabaseService"

export const addItems = (imageUrls: string[]) => 
  runServerAction(
    Effect.gen(function* () {
      yield* Effect.logInfo("Starting addItems", { count: imageUrls.length })
      
      // Logic here using services...
      const gemini = yield* GeminiService
      // ...
      
      yield* Effect.logInfo("Successfully added items")
      return { success: true }
    }).pipe(
      Effect.withSpan("action.addItems", { attributes: { "app.image_count": imageUrls.length } }),
      Effect.provide(GeminiService.Live),
      Effect.provide(SupabaseService.Live)
    )
  )
```

---

## 4. Testing Plan

Using `Vitest` with Effect makes testing granular and deterministic by swapping Layers.

### 4.1 Unit Tests

Test business logic by providing Test Layers (mocks) instead of Live Layers.

```typescript
// src/services/GeminiService.test.ts
import { it, describe, expect } from "vitest"
import { Effect, Layer } from "effect"
import { GeminiService } from "./GeminiService"

const GeminiTest = Layer.succeed(
  GeminiService,
  GeminiService.of({
    generateContent: () => Effect.succeed("Mocked Response"),
  })
)

it("analyzes wardrobe", async () => {
  const result = await Effect.runPromise(
    analyzeWardrobe(...).pipe(Effect.provide(GeminiTest))
  )
  expect(result).toBe(...)
})
```

---


---

## 5. Implementation Roadmap

### Phase 1: Foundation (Current)
- [ ] Install Effect & Telemetry packages (`@effect/opentelemetry`, `@opentelemetry/sdk-node`, etc.)
- [ ] Create `src/lib/effect-runtime.ts` (Global Runtime/Layer configuration)
- [ ] Create `src/lib/run-effect.ts` (Next.js adapter)

### Phase 2: Services Refactor
- [ ] Create `src/services/SupabaseService.ts`
- [ ] Create `src/services/GeminiService.ts`
- [ ] Create `src/services/ArcjetService.ts`

### Phase 3: Action Instrumentation
- [ ] Refactor `addItems` in `src/app/actions.ts` to use Effect pipeline
- [ ] Refactor `checkCompatibility` in `src/app/actions.ts`
- [ ] Verify logs and traces appear in Axiom

### Phase 4: Testing & Polish
- [ ] Configure `vitest`
- [ ] Write unit tests for Services
- [ ] Write integration tests for Actions (mocking external services)

---

## 6. Next Steps

1.  **Approve Plan**: Please review this updated plan.
2.  **Execute Phase 1**: I will install dependencies and set up the Effect runtime.
3.  **Execute Phase 2**: I will build the Service Layers.

*Created: 2026-01-05*
*Branch: feature/testing-instrumentation-logging*

