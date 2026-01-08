---
description: Implementation Plan for Effect Refactor and Telemetry
---
# Implementation Plan - Effect Refactor & Telemetry

This plan outlines the steps to refactor the Wardrobe application to use the Effect library for robust error handling, dependency injection, and OpenTelemetry integration.

## User Review Required

> [!IMPORTANT]
> This plan changes the core architecture from direct API calls to Effect Layers. Please review the proposed structure.

- **Objective**: Implement Testing & Instrumentation Plan using Effect.
- **Branch**: `feature/testing-instrumentation-logging`

## Proposed Changes

### Phase 1: Foundation (Current)

1.  **Dependencies**
    - [ ] Install `@effect/opentelemetry`, `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`, etc.
2.  **Runtime Configuration**
    - [ ] Create `src/lib/effect-runtime.ts` to configure the global Effect runtime with OpenTelemetry (Axiom exporter).
    - [ ] Create `src/lib/run-effect.ts` as a helper to run Effect programs in Next.js Server Actions.

### Phase 2: Services Refactor

3.  **Supabase Service**
    - [ ] Create `src/services/SupabaseService.ts` wrapping the Supabase client.
4.  **Gemini Service**
    - [ ] Create `src/services/GeminiService.ts` wrapping Google Generative AI.
5.  **Arcjet Service**
    - [ ] Create `src/services/ArcjetService.ts` for rate limiting/bot detection.

### Phase 3: Action Instrumentation

6.  **Refactor Server Actions**
    - [ ] Modify `src/app/actions.ts` to use `Effect.gen` and the new Services.
    - [ ] Add `Effect.withSpan` for tracing.
    - [ ] Add `Effect.log` for structured logging.

### Phase 4: Testing

7.  **Vitest Setup**
    - [ ] Configure `vitest.config.ts`.
    - [ ] Create Test Layers (mocks) for services.
    - [ ] Write unit tests for Services and integration tests for Actions.

## Verification Plan

### Automated Tests
- Run `bun test` to execute the new Vitest suite.
- Verify 100% pass rate for new Service tests.

### Manual Verification
- **Traces**: Trigger an action (add item) and verify the trace appears in Axiom.
- **Logs**: Verify structured logs with `userId` and `traceId` in Axiom.
- **Functionality**: Ensure the app behaviors (upload, compatibility check) remain unchanged.
