# Interactive code-path debugging

`bun run debug` starts a local Bun test or TypeScript entrypoint and connects a small terminal client to its WebKit inspector. It supports conditional breakpoints, paused stacks, local/closure variables, frame evaluation, stepping, and exception pauses. It requires no new dependency or account. The same process stays alive between terminal tool calls.

Use a focused synthetic test to reproduce the real implementation. The launcher binds to loopback, strips inherited application credentials, and disables automatic `.env` loading. This is a convenience, not a sandbox: target code and evaluated expressions can perform I/O. Use trusted local code or an isolated Cloud environment. It never attaches to a deployed Convex function. `convex-test` runs the real registered handlers with an in-memory backend and does not reproduce every database/runtime limit.

## Start and inspect

From the repository root, start this in an interactive terminal (Codex `exec_command` with `tty: true`):

```sh
bun run debug --cwd apps/web -- test confect/storage.integration.test.ts --test-name-pattern 'forged legacy photo' --timeout 600000
```

Wait for `event: ready`. The target has not started. Send one JSON object per line through the same terminal session. Set a pending breakpoint at the beginning of the relevant module, then start execution:

```json
{"command":"break","urlRegex":"confect/storageAccess.ts$","line":1}
{"command":"continue"}
```

Wait for `event: paused`; then inspect the executable source:

```json
{"command":"source","count":40}
```

**Coordinates are 1-based inspector-source lines/columns, not original TypeScript coordinates.** Bun transpiles TypeScript and may put an entire callback on one line. Read `source` before choosing the exact line/column; this client does not apply source maps. `breakpointResolved.location` comes directly from the protocol and is 0-based. `paused.stack` and `source` are displayed 1-based. Script IDs and breakpoint IDs belong to this session.

Remove the module breakpoint using the returned `breakpointId`, then set one inside the callback. In the current source, `requireOwned` is on inspector line 5 and `record?.userId` starts at column 88; confirm that in your session rather than relying on these numbers after a change:

```json
{"command":"remove","breakpointId":"/confect/storageAccess.ts$/:0:0"}
{"command":"break","urlRegex":"confect/storageAccess.ts$","line":5,"column":88}
{"command":"continue"}
```

After the pause, inspect only the values needed for the hypothesis:

```json
{"command":"eval","expression":"({requestingUser: userId, authoritativeOwner: record?.userId, matches: record?.userId === userId})"}
{"command":"locals"}
{"command":"next"}
```

For the legitimate control, remove that breakpoint and replace it with the same location plus `"condition":"record?.userId === userId"`. Continue and inspect the owner values. Remove breakpoints and continue until `event: exit` confirms the test result. `quit`, Ctrl-C or closed stdin stops the owned target with cancellation status 130; stopping is not a test pass.

## Commands and other code paths

| Command | Arguments / behavior |
| --- | --- |
| `sources` | Optional `filter` substring; lists loaded script IDs and URLs. |
| `source` | Optional `scriptId`, `from`, `count` (max 120); otherwise current paused frame. |
| `break` | `urlRegex`, `line`, optional `column` and JavaScript `condition`. |
| `remove` | `breakpointId` returned by `break`. |
| `stack` | Up to 20 frames, indexed from zero. |
| `locals` | Optional zero-based `frame`; bounded non-global scope properties. |
| `eval` | `expression`, optional `frame`; evaluation may have side effects. Prefer small value projections. |
| `continue`, `pause` | Start/resume execution, or pause a running target. |
| `next`, `step`, `out` | Step over, into, or out of the current frame. |
| `exceptions` | `state`: `none`, `uncaught`, or `all`. |
| `quit` | Stop the debugger and its target. |

Change the test file/name to follow planner mutations, bounded read models, streaming cancellation, or an isolated service with supplied Effect Layers. For a minimized fuzz failure, first reproduce the seed/path with `validate fuzz`; use a temporary regression fixture for interactive stepping. Paused time counts toward Bun test timeouts, hence the longer timeout above.

Effect failures are values in a fiber until a boundary converts them into thrown errors. An exception pause alone may miss the domain decision. Put breakpoints in the application callback or service implementation; blindly stepping through Effect's scheduler is usually less useful. Inspect a rejected case and an ordinary successful case, then run the focused test without the debugger. Record the revision, reproduction, observed values, and remaining hypothesis.

For a human visual UI, launch Bun directly with `--inspect-brk=127.0.0.1:6499` and open the inspector URL it prints, using the same synthetic test and a sanitized environment. That UI supports source maps. Use a separate launch instead of attaching a second debugger to the terminal client's process. See [Bun debugging](https://bun.com/docs/runtime/debugger).

The browser gallery's Playwright traces and `probe:browser` cover UI actions and network/log timing. A browser renderer or Expo/Hermes JavaScript breakpoint needs that runtime's debugger; this Bun helper does not attach to those runtimes. For hosted Convex incidents, use logs/request IDs to isolate a reproduction, then step through the local fixture. See [Convex debugging](https://docs.convex.dev/functions/debugging).
