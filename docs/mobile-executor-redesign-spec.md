# Mobile Executor Redesign — Phase 1 Specification

**Status:** Specification approved; implementation pending
**Date approved:** 2026-05-07
**Implementation target:** New Claude Code session on personal Linux Mint laptop
**Framework version this targets:** Agentic QE Framework v2 (latest at time of writing)

---

## How to use this document

This spec captures the full context, root-cause analysis, decisions, and detailed Phase 1 design for redesigning how mobile automation is executed in the framework. It is intentionally self-contained — a fresh Claude Code session reading only this file should be able to implement Phase 1 exactly as agreed without re-litigating decisions.

When implementing, read sections 1–3 first (the *why*), then 4–7 (the *what*), then 9–10 (the *how* and *validation*). Sections 8 and 11 are forward-looking — only relevant when planning beyond Phase 1.

If a decision in this spec turns out to be wrong during implementation, do NOT silently change it — flag it back to the user and update this spec before changing code.

---

## Table of Contents

1. [Background — Why This Redesign](#1-background--why-this-redesign)
2. [Architectural Decision](#2-architectural-decision)
3. [Architecture](#3-architecture)
4. [Phase 1 Deliverables](#4-phase-1-deliverables)
5. [Contracts](#5-contracts)
6. [Targets Supported in Phase 1](#6-targets-supported-in-phase-1)
7. [Edge Cases](#7-edge-cases-phase-1)
8. [Future Phases](#8-future-phases)
9. [Implementation Sequence](#9-implementation-sequence)
10. [Validation Plan](#10-validation-plan)
11. [Open Questions to Resolve During Build](#11-open-questions-to-resolve-during-build)
12. [Glossary](#12-glossary)

---

## 1. Background — Why This Redesign

### 1.1 The problem

The existing Executor agent (`agents/core/executor.md`) was designed around Playwright's fast feedback loop (web tests complete in 30–60 seconds). When applied to mobile automation — which uses WDIO + Mocha + Appium and runs on real devices, emulators, or simulators — the feedback loop is 5–15 minutes per cycle. The same agent design fails repeatedly on mobile because the assumptions baked into its workflow do not match mobile reality.

### 1.2 Failure modes observed (real session, 2026-05-06 to 2026-05-07)

A team member ran the Executor on a mobile spec (`output/tests/mobile/connect-mobile-InTransit-tab.spec.ts`) on a real Samsung SM-X526B Android device via Copilot Agent Mode (Claude Sonnet 4.6). The following failures occurred over multiple attempted runs:

| # | Symptom | Phase |
|---|---------|-------|
| 1 | Skipped the `RUN test` step entirely; jumped straight to Diagnostic Gate using stale `last-run-parsed.json` from a previous session | Initial run |
| 2 | After deleting parsed JSONs, latched onto other prior-session artifacts (`cycle1-raw.txt`, `executor-report-{scenario}.md`) | Second attempt |
| 3 | Lost ~2 minutes when `runCommand` stripped the `cd output &&` prefix and ran wdio from the wrong directory | Cycle 1 start |
| 4 | After kicking off wdio: agent narrated "I'll wait for the terminal notification rather than polling" → went silent → Copilot chat ended without continuation | Cycles 1, 2, 3 |
| 5 | Wdio process exited but agent did not detect it; needed manual nudge ("the wdio process has exited — proceed to parse") | Cycles 1, 2 |
| 6 | Cycle 3: agent went fully silent; user manually verified wdio process was dead, ran the spec themselves to confirm fix worked | Cycle 3 |

The fix the agent eventually produced was correct (the test passed). The *workflow* to get there was unusable: every cycle required manual intervention, the chat session terminated abruptly, and stale artifacts repeatedly misled the diagnostic step.

### 1.3 Root cause analysis

Five distinct root causes, in priority order:

#### RC-1: Copilot's `runCommand` is fundamentally wrong for mobile

`runCommand` in Copilot Agent Mode is built for short, deterministic shell commands (npm install, tsc, git status). It uses an asynchronous background-execution + completion-notification handshake that becomes unreliable when the underlying command:
- Runs longer than ~2–3 minutes
- Is interactive on the OS (Appium connection, ADB shell)
- Exits non-zero without a clean SIGTERM

Mobile-on-device tests hit all three. Appium session creation alone is 30–90 seconds before any output, plus app install, plus the test, plus session cleanup — easily 5–15 minutes per cycle. **This is not a framework bug; it is a tool-runtime mismatch.** The Copilot wrapper inherited this without mitigation.

Claude Code's `Bash` tool has different semantics (foreground execution with streaming), so this RC manifests less severely there — but the framework should not be tied to one IDE's toolchain.

#### RC-2: The Executor's cycle architecture assumes fast feedback

`agents/core/executor.md` §4 Cycle structure is:
```
RUN → PARSE → DIAGNOSE → FIX → RUN
```
designed for ~60-second iterations. There is no instruction for "what to do while a long-running test executes," no streaming/tailing pattern, no heartbeat. The agent improvises, and Sonnet 4.6's improvisation is "background it and wait for notification" — which loops back to RC-1.

#### RC-3: Framework instruction gaps that enable drift

Concrete holes in the latest `executor.md`:

- §2 Pre-flight reads does NOT explicitly forbid reading `output/test-results/*` until after Cycle 1 has executed. Without that prohibition, the agent reads stale evidence as "preparation."
- §3 Pre-flight Fidelity Audit does not include "wipe stale artifacts."
- §4.1 Run the Test gives the wdio command but no guidance on long-running execution semantics.
- No mobile-specific Executor wrapper exists. `.github/agents/executor.agent.md` is generic — same instructions for web (30-second feedback) and mobile (15-minute feedback).

#### RC-4: Sonnet 4.6's optimization tendency

The model is biased toward "save a step." Seeing `last-run-parsed.json` it concludes "I can save a test cycle by analyzing this first — maybe the previous fix already worked." That logic is reasonable for an experienced human operator. It is catastrophic for an agent whose entire value proposition is *deterministic execution of the cycle*.

The framework instructions correctly say "run first," but the rule is not framed as a hard failure condition the model cannot talk itself out of.

#### RC-5: Operational hygiene gaps

- Cycle output files (`cycle1-raw.txt` … `cycle7-raw.txt`) accumulate across sessions. They look authoritative; the agent reads them.
- Prior `executor-report-{scenario}.md` is read as if it were resumable state.
- No automated cleanup. The framework expects the user to manually wipe artifacts between sessions — exactly the operational burden that creates these failures.

---

## 2. Architectural Decision

### 2.1 Options considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A | Tighten executor.md rules; accept manual-nudge ritual | Rejected — band-aid, doesn't address RC-1 |
| B | Build a mobile-specific Executor variant (`executor-mobile.md`) with mobile-aware cycle pattern | **Selected** |
| C | Move long-running execution out of the agent loop into a wrapper script that handles wdio and writes a deterministic "done" marker | **Selected** |
| D | Drop autonomous execution; user runs wdio manually, agent only diagnoses + fixes | Rejected — user wants self-driving |

**Selected: B + C combined.** They are complementary, not competing:
- **C** solves RC-1 and RC-2: the wrapper script handles long-running execution; the agent stays out of the runCommand handshake entirely.
- **B** solves RC-3 and RC-4: mobile-specific instructions close the gaps the generic Executor leaves open.
- RC-5 is closed by C (wrapper does cleanup automatically).

### 2.2 Completion detection mechanism: Pattern 1 (Marker File Polling)

The wrapper script writes a marker file (`cycle{N}-done.json`) when execution completes. The agent polls for this marker via short, fast `Test-Path` / `ls` commands every ~30 seconds — each poll is an instant runCommand that returns immediately, so it is not subject to the long-command notification failure mode.

**Why this pattern over the alternative (Pattern 2 — synchronous block + raw-file tail fallback):**

- Pattern 1 fully decouples Copilot's broken notification from the cycle.
- The marker file is a useful CI artifact in its own right (machine-readable run summary).
- Polling is procedural but predictable; predictability beats elegance for an agent contract.

### 2.3 Phase 1 scope: Option α (local only)

Two scoping options were considered:

- **Option α:** Phase 1 = physical Android + Android Emulator + iOS Simulator (local Appium). Cloud and AWS Device Farm in later phases. **Selected.**
- **Option β:** Phase 1 = local + 3 cloud vendors (BrowserStack, Sauce Labs, LambdaTest). AWS Device Farm later.

**Rationale for α:** Cloud requires vendor API integration, app upload flows, tunnel-daemon checks, and billing tracking — substantial surface area orthogonal to the runCommand-handshake problem we are solving. Shipping the local solution first proves the marker contract and the agent flow; cloud is then a self-contained additive phase.

### 2.4 Backward compatibility: remove mobile sections from `executor.md`

Once `executor-mobile.md` lands, the mobile sections in `agents/core/executor.md` (§4.1 mobile commands, §7 Mobile Failure Signatures, mobile-specific fixes in §4.5) are **removed**, not deprecated.

**Rationale:** Two sources of truth on mobile execution would inevitably drift. The framework already follows a "single canonical instruction file per agent role" pattern; we honor it.

### 2.5 Failure taxonomy refinement

The original ask was "exit gracefully with proper logs." Refined: **not all failures should drive the same agent response.** Treating "Appium server didn't start" the same as "element not found" is exactly how the existing Executor wastes cycles.

Marker carries a `status` field that classifies the failure into one of:
- `TEST_PASS` — all `it()` blocks passed
- `TEST_FAILURE` — wdio ran cleanly; some `it()` failed (the legitimate Diagnostic Gate domain)
- `INFRA_FAILURE` — wdio started but session creation failed (Appium dropped, device disconnected, app install failed)
- `ENV_FAILURE` — pre-execution: Appium not startable, ANDROID_HOME unset, no ADB device, spec file missing
- `RUNNER_CRASH` — mobile-runner.js itself crashed (disk full, OOM, unhandled exception)

Cycle counter only increments on `TEST_PASS` and `TEST_FAILURE`. INFRA / ENV / RUNNER_CRASH are not "real" cycles — they are setup hiccups and must not consume the cycle budget.

**Rationale:** maxCycles = N means N *test* cycles, not N *attempts*. An Appium hiccup must not burn a cycle. The existing Executor has no concept of this distinction.

---

## 3. Architecture

### 3.1 High-level diagram

```
┌─────────────────────────────────────────────────────────────┐
│  agents/core/executor-mobile.md                             │
│  (Option B — mobile-specific Executor instructions)         │
│                                                             │
│  Cycle pattern:                                             │
│  1. Invoke mobile-runner.js for current cycle               │
│  2. Poll for cycle{N}-done.json marker (every ~30s)         │
│  3. Read marker + parsed results + page-source XML          │
│  4. Diagnostic Gate (mobile-specific: a11y tree based)      │
│  5. Apply fix; re-invoke mobile-runner.js for next cycle    │
└─────────────────────────────────────────────────────────────┘
                             │ invokes
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  scripts/mobile-runner.js                                   │
│  (Option C — execution decoupled from agent)                │
│                                                             │
│  1. Pre-flight cleanup: wipe test-results/* if cycle == 1   │
│  2. Detect target type (physical/emulator/simulator)        │
│  3. Health-check target; auto-start if emulator/simulator   │
│  4. Verify Appium server alive (auto-start if missing)      │
│  5. cd output/                                              │
│  6. Spawn wdio with platform filter + bounded timeout       │
│  7. Stream stdout to cycle{N}-raw.txt + cycle{N}-tail.txt   │
│  8. Capture exit code on completion                         │
│  9. Auto-invoke test-results-parser.js                      │
│ 10. Write cycle{N}-done.json (atomic) with full marker      │
│ 11. Exit 0 — agent reads marker for status                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Data flow

```
[scenario.md] → [Builder] → [output/tests/mobile/scenario.spec.ts]
                            [output/screens/*.ts]
                            [output/locators/mobile/*.json]
                                       │
                                       ▼
                          [executor-mobile.md agent]
                                       │ invokes
                                       ▼
                          [scripts/mobile-runner.js]
                                       │ runs
                                       ▼
                          [npx wdio run → on-device test]
                                       │ produces
                                       ▼
                          [cycle{N}-raw.txt, cycle{N}-tail.txt,
                           cycle{N}-done.json marker,
                           page-source-cycle{N}.xml,
                           test-failed-cycle{N}.png]
                                       │ polled by
                                       ▼
                          [executor-mobile.md agent]
                                       │ if TEST_FAILURE
                                       ▼
                          [Diagnostic Gate → Fix]
                                       │
                                       └──► loop or terminate
```

### 3.3 Component responsibilities

| Component | Owns | Does NOT own |
|-----------|------|--------------|
| `mobile-runner.js` | Target detection, target/Appium auto-start, wdio execution, output streaming, parsing invocation, marker writing, atomic file writes | Cycle counter, fixes, scenario semantics, agent narrative |
| `executor-mobile.md` (the agent) | Cycle counter, Diagnostic Gate, fix application, report generation, escalation decisions, cycle markers in the report | Process management, target lifecycle, raw output parsing |
| `framework-config.json` | Configuration values: timeouts, cleanup behavior, headless mode, max cycles | Logic — purely declarative |

---

## 4. Phase 1 Deliverables

### 4.1 `scripts/mobile-runner.js` — the wrapper script

**Type:** New file
**Language:** Node.js (consistent with existing scripts in `scripts/`)
**Invocation:**
```bash
node scripts/mobile-runner.js \
  --scenario <scenario-name> \
  --platform <android|ios> \
  --cycle <N> \
  [--folder <subfolder>]
```

**Responsibilities (in order):**

1. **Parse args.** Validate `--scenario`, `--platform`, `--cycle` (integer ≥1).
2. **Cleanup gate.** If `cycle == 1`, wipe `output/test-results/*` (preserves directory). For cycle > 1, leave artifacts in place — they belong to this run.
3. **Pre-flight environment validation.** In order:
   - Verify `output/tests/mobile/[{folder}/]{scenario}.spec.ts` exists. If not → `ENV_FAILURE` with path.
   - Verify `process.env.PLATFORM` matches `--platform` arg. If mismatch → `ENV_FAILURE`.
   - For Android: verify `ANDROID_HOME` is set and points to a valid SDK. If not → `ENV_FAILURE`.
   - For iOS: verify `xcrun` is on PATH (macOS only). If not → `ENV_FAILURE`.
4. **Target detection** (see §6 below). Decide physical / emulator / simulator / cloud / unsupported. Cloud → `ENV_FAILURE` with "Cloud support is Phase 2." Unknown → `ENV_FAILURE`.
5. **Target health-check.** Per-target probe (see §6). If unhealthy and target supports auto-start, attempt auto-start (with bounded timeout). If still unhealthy → `INFRA_FAILURE`.
6. **Appium server health-check.** HTTP GET `http://localhost:4723/status`. If 200 OK → reuse. If port held by something other than Appium → `ENV_FAILURE`. If port free → auto-start Appium (`appium &` or platform-specific) and wait up to 30s for `/status` 200.
7. **Track lifecycle ownership.** Record `targetStartedByRunner: bool`, `appiumStartedByRunner: bool` for cleanup decisions.
8. **Compose wdio command.**
   ```bash
   cd output && PLATFORM=<platform> npx wdio run wdio.conf.ts \
     --spec tests/mobile/[{folder}/]{scenario}.spec.ts \
     --mochaOpts.grep "@<platform>-only|@cross-platform"
   ```
9. **Spawn wdio.** Stream stdout/stderr to `output/test-results/cycle{N}-raw.txt`. In parallel, maintain `output/test-results/cycle{N}-tail.txt` containing last 200 lines + every line matching `/\[ERROR\]|\[FAIL\]|FAIL: |Error: /`.
10. **Enforce bounded timeout.** `mobile.runner.maxRunDurationMs` from `framework-config.json` (default: 1,200,000 ms = 20 min). On timeout, kill child process tree (Node `tree-kill` package or equivalent), record `INFRA_FAILURE` with `reason: "wdio_hung"`.
11. **On wdio exit:** capture exit code. Invoke `node scripts/test-results-parser.js --results-dir=output/test-results` to populate `last-run-parsed.json`.
12. **Capture failure artifacts** (if any failed test):
    - Page source XML at first failure point → `output/test-results/page-source-cycle{N}.xml`
    - Screenshot at first failure → `output/test-results/test-failed-cycle{N}.png`
    - These come from the WDIO `afterTest` hook in `wdio.conf.ts`; runner just verifies they exist and references them in the marker.
13. **Compute marker.** Build the JSON object per §5.1. Determine `status` from exit code + parsed results:
    - exit 0 + `failed == 0` → `TEST_PASS`
    - exit non-zero + parsed results have failed tests → `TEST_FAILURE`
    - exit non-zero + no parsed results → `INFRA_FAILURE` (session never created)
    - timeout enforced → `INFRA_FAILURE` with reason
    - any caught exception in the runner itself → `RUNNER_CRASH`
14. **Atomic write.** Write marker to `output/test-results/cycle{N}-done.json.tmp`, then `Move-Item` (Node: `fs.renameSync`) to `cycle{N}-done.json`. Never leaves a half-written marker on disk.
15. **Cleanup.** If `targetStartedByRunner == true` and config `mobile.target.cleanupOnExit == true`, stop the target. If `appiumStartedByRunner == true` and config `mobile.appium.cleanupOnExit == true`, stop Appium.
16. **Always exit 0.** Status is in the marker, not the exit code. This isolates the agent from runCommand's exit-code handling.

**Cross-platform notes:**

- Use `path.join()` for all paths (per `agents/shared/guardrails.md` §11).
- Process management: use Node's `child_process.spawn`, not platform-specific shell invocations.
- The runner runs on the user's host (Linux Mint, macOS, Windows), not on the device.

### 4.2 `agents/core/executor-mobile.md` — mobile-specific Executor instructions

**Type:** New file
**Inherits structure from:** `agents/core/executor.md`
**Differences from `executor.md`:**

| Section | Web Executor (`executor.md`) | Mobile Executor (`executor-mobile.md`) |
|---------|------------------------------|------------------------------------------|
| §1 Identity | Generic | "Mobile Executor" — explicitly scoped to `mobile` and `mobile-hybrid` types only |
| §2 Pre-flight reads | List of files | Same list **plus** explicit prohibition: *"DO NOT read `output/test-results/*` until after the current cycle's mobile-runner.js has produced its marker. Stale artifacts from prior sessions will mislead diagnosis."* |
| §3 Pre-flight audit | TSC + step count + keyword spot-check | Same, plus: *"DO NOT manually clean `output/test-results/*` — mobile-runner.js handles this on cycle 1."* |
| §4 Cycle pattern | RUN → PARSE → DIAGNOSE → FIX | INVOKE_RUNNER → POLL_MARKER → CLASSIFY_BY_STATUS → DIAGNOSE_OR_RETRY → FIX (full diagram in §4.6 of this spec doc) |
| §4.1 Run the test | `npx wdio run ...` | `node scripts/mobile-runner.js --scenario X --platform android --cycle N` |
| §4.2 Parse results | `node scripts/test-results-parser.js ...` | Read `cycle{N}-done.json` marker; parser already invoked by runner |
| §4.3 Read artifacts | `error-context.md` + screenshot | `cycle{N}-tail.txt` + `page-source-cycle{N}.xml` + `test-failed-cycle{N}.png`. Read tail by default; raw on demand only |
| §4.4 Diagnostic Gate | DOM-based element presence check | **Page-source-XML-based** element presence check. Apply per `marker.status` first — only run Diagnostic Gate on `TEST_FAILURE` |
| Cycle counter | Increments every run | Increments only on `TEST_PASS`/`TEST_FAILURE`; INFRA/ENV/RUNNER_CRASH retries do not increment |
| Mobile-specific fixes (former §4.5 mobile bullet) | Inline | Promoted to a top-level §5 with full recipes |
| §7 Mobile Failure Signatures | Inline in `executor.md` | Moved here, expanded for the marker-status taxonomy |

**Key rule additions in `executor-mobile.md`:**

- **HARD STOP:** *"You MUST NOT read `last-run-parsed.json`, `error-context.md`, `cycle*-raw.txt`, `cycle*-done.json`, or `cycle*-tail.txt` before mobile-runner.js has been invoked for the current cycle. If you find yourself doing so, you have violated §2 — stop and invoke the runner first."* (Closes RC-3 and RC-4.)
- **Polling protocol:** *"After invoking mobile-runner.js, poll for `cycle{N}-done.json` every 30 seconds via `Test-Path` (PowerShell) / `ls` (bash). Do not depend on the runCommand notification. Maximum poll duration: marker SHOULD appear within `mobile.runner.maxRunDurationMs + 60s`. If exceeded, treat as `RUNNER_CRASH` and check runner logs."*
- **Status-driven branching:** Single source of truth for "what does the agent do next" is the `status` field of the marker.

### 4.3 `agents/claude/executor-mobile.md` — Claude Code wrapper

**Type:** New file
**Pattern:** Mirrors `agents/claude/executor.md` (~37 lines)
**Tool mapping:**
- `Bash` for invoking `mobile-runner.js`
- `Bash` for polling marker file
- `Read` for reading marker, tail log, page source
- `Edit` for fixes
- `Write` for executor report

### 4.4 `.github/agents/executor-mobile.agent.md` — Copilot wrapper

**Type:** New file
**Pattern:** Mirrors `.github/agents/executor.agent.md`
**Frontmatter:** `name: QE Mobile Executor`, description scoped to mobile/mobile-hybrid only

### 4.5 Updates to existing files

| File | Change | Reason |
|------|--------|--------|
| `agents/shared/type-registry.md` | Per-Agent Type Lookup → Executor table → for `mobile` and `mobile-hybrid` rows, change "Test command" cell to `node scripts/mobile-runner.js --scenario ... --platform ... --cycle N`; add row "Source of cycle results" → `cycle{N}-done.json marker` | Routes mobile to the new executor |
| `agents/core/orchestrator.md` | When dispatching to Executor for mobile/mobile-hybrid types, route to `executor-mobile.md` instead of `executor.md` | Pipeline integration |
| `agents/core/executor.md` | **Remove** all mobile-specific content: §4.1 mobile commands, §7 Mobile Failure Signatures, mobile bullets in §4.5 (Mobile-specific fixes the Executor can apply), mobile rows in any tables | Single source of truth (per §2.4 of this spec) |
| `agents/core/healer.md` | If Healer re-runs tests after applying fixes, route mobile re-runs through `mobile-runner.js`. **Confirm dependency before editing** — read existing `healer.md` to see whether it actually invokes test runs or only edits code | Avoid bypassing the wrapper |
| `framework-config.json` | Add new keys (see §5.5) | Configuration surface |

---

## 5. Contracts

### 5.1 Marker file schema

**Path:** `output/test-results/cycle{N}-done.json`
**Write semantics:** Atomic — write `.tmp` then rename
**Always written** — even on `RUNNER_CRASH`, the runner's outermost try/catch writes a marker before exiting

```json
{
  "schemaVersion": "1.0",
  "scenario": "connect-mobile-InTransit-tab",
  "platform": "android",
  "cycle": 1,
  "status": "TEST_FAILURE",
  "timestamp": "2026-05-07T14:32:18.524Z",
  "target": {
    "type": "emulator",
    "id": "emulator-5554",
    "platformVersion": "13",
    "startedByRunner": true,
    "bootDurationMs": 42000,
    "accelerationStatus": "hardware",
    "headless": false
  },
  "appium": {
    "url": "http://localhost:4723",
    "version": "2.0.1",
    "startedByRunner": false
  },
  "duration": {
    "totalMs": 320000,
    "preflightMs": 8000,
    "targetBootMs": 0,
    "appiumBootMs": 0,
    "wdioMs": 278000,
    "parseMs": 800,
    "cleanupMs": 200
  },
  "results": {
    "total": 1,
    "passed": 0,
    "failed": 1,
    "firstFailure": {
      "title": "should select Accepted appointment with IN TRANSIT button",
      "stepIndex": 7,
      "errorMessage": "Element not found: appointmentInTransitButton",
      "errorType": "ElementNotFound"
    }
  },
  "artifacts": {
    "rawLog": "test-results/cycle1-raw.txt",
    "tailLog": "test-results/cycle1-tail.txt",
    "parsedJson": "test-results/last-run-parsed.json",
    "pageSource": "test-results/page-source-cycle1.xml",
    "screenshot": "test-results/test-failed-cycle1.png"
  },
  "runnerVersion": "1.0.0",
  "wdioCommand": "PLATFORM=android npx wdio run wdio.conf.ts --spec tests/mobile/connect-mobile-InTransit-tab.spec.ts --mochaOpts.grep \"@android-only|@cross-platform\""
}
```

**Field guarantees:**

- `schemaVersion` — present on every marker; bump if schema breaks.
- `status` — always one of the five values.
- `cycle` — matches the `--cycle N` arg. The runner does NOT compute next-cycle numbers; the agent owns the cycle counter.
- `target.startedByRunner` and `appium.startedByRunner` — required for cleanup decisions and post-mortem.
- `artifacts.*` — paths are relative to `output/`, agent must resolve.
- `results.firstFailure` — only present when `failed > 0`; on multi-failure runs, agent reads `parsedJson` for the full list.
- On `INFRA_FAILURE`/`ENV_FAILURE`/`RUNNER_CRASH`: `results` may be absent; instead a `failureReason` top-level field carries human-readable diagnostic + remediation hint.

### 5.2 Failure taxonomy and agent response

| Status | When | Cycle counter | Agent response |
|--------|------|---------------|----------------|
| `TEST_PASS` | All `it()` blocks passed | +1, then DONE | Write final report; cycle marker `<!-- CYCLE_COMPLETE: N of M --> ✅ PASS`; exit |
| `TEST_FAILURE` | wdio ran cleanly; ≥1 `it()` failed | +1 | Apply Diagnostic Gate (§4.4 of `executor-mobile.md`); fix; re-invoke runner with cycle N+1 |
| `INFRA_FAILURE` | wdio started but session creation failed (Appium dropped, device disconnected, app install failed, wdio hung) | **No increment** | Read `failureReason`; if remediable (e.g., restart Appium), retry the same cycle. Two `INFRA_FAILURE`s in a row → escalate |
| `ENV_FAILURE` | Pre-execution: missing config, no device, etc. | **No increment** | Cannot self-fix — write report explaining what is missing; escalate to user |
| `RUNNER_CRASH` | mobile-runner.js itself crashed | **No increment** | Read crash log; re-invoke same cycle. Two crashes in a row → escalate |

### 5.3 Logging contract

| File | Content | Who writes | Who reads |
|------|---------|------------|-----------|
| `output/test-results/cycle{N}-raw.txt` | Full wdio stdout/stderr stream | mobile-runner.js (live append) | Agent on demand only |
| `output/test-results/cycle{N}-tail.txt` | Last 200 lines + every line matching error/fail patterns | mobile-runner.js (continuous filter) | Agent by default |
| `output/test-results/cycle{N}-done.json` | Marker (see §5.1) | mobile-runner.js (atomic write at end) | Agent (polled) |
| `output/test-results/page-source-cycle{N}.xml` | Appium page source at first failure | wdio.conf.ts `afterTest` hook | Agent during Diagnostic Gate |
| `output/test-results/test-failed-cycle{N}.png` | Screenshot at first failure | wdio.conf.ts `afterTest` hook | Agent during Diagnostic Gate |
| `output/test-results/last-run-parsed.json` | Structured pass/fail data | scripts/test-results-parser.js | Agent for multi-failure cycles |

### 5.4 Cycle counter rules

- Owned by the agent (`executor-mobile.md`), NOT the runner.
- Increments only on `TEST_PASS` / `TEST_FAILURE` markers.
- Maximum from `framework-config.json → executor.maxCycles` (default 3, but configurable to 10 etc.).
- Agent writes `<!-- CYCLE_COMPLETE: N of M -->` to the executor report after each successful cycle (preserves Reviewer contract — Reviewer counts these markers).
- The runner's `--cycle N` arg is informational (used for filename suffixes); the runner does not validate that N is in sequence.

### 5.5 New `framework-config.json` keys

Add under a new top-level `mobile` block:

```json
{
  "mobile": {
    "runner": {
      "maxRunDurationMs": 1200000,
      "cleanupOnCycle1": true,
      "tailLines": 200
    },
    "target": {
      "headless": false,
      "cleanupOnExit": true,
      "resetOnInfraFailure": true,
      "emulatorBootTimeoutMs": 90000,
      "simulatorBootTimeoutMs": 30000,
      "useSnapshotForEmulator": false
    },
    "appium": {
      "url": "http://localhost:4723",
      "autoStart": true,
      "startupTimeoutMs": 30000,
      "cleanupOnExit": false
    }
  }
}
```

Existing keys (e.g., `executor.maxCycles`) are unchanged.

---

## 6. Targets Supported in Phase 1

### 6.1 Detection logic (precedence order)

1. If `BROWSERSTACK_USERNAME` / `SAUCE_USERNAME` / `LT_USERNAME` set → vendor cloud detected → `ENV_FAILURE` "Cloud support is Phase 2."
2. If `AWS_DEVICE_FARM_PROJECT_ARN` set → `ENV_FAILURE` "AWS Device Farm is Phase 7."
3. If platform = `ios`:
   - If `IOS_SIM_UDID` set → iOS Simulator path
   - Else `xcrun simctl list booted` returns ≥1 entry → iOS Simulator path (use first)
   - Else if physical iOS device detected → not in Phase 1 → `ENV_FAILURE` "Physical iOS support is Phase 1.5"
4. If platform = `android`:
   - If `ANDROID_AVD` set → Android Emulator path (auto-start by name)
   - Else `adb devices` parsed:
     - Multiple devices and no `ANDROID_DEVICE` → `ENV_FAILURE` listing all serials
     - Single device, serial matches `emulator-*` → Android Emulator path
     - Single device, other serial → Physical Android path
     - Zero devices → `ENV_FAILURE` "No Android device detected"

### 6.2 Per-target operations table

| Target type | Health-check | Auto-start (if missing) | Boot-ready signal | Cleanup (if config enabled) |
|-------------|--------------|--------------------------|-------------------|------------------------------|
| **Physical Android** | `adb -s {serial} shell getprop sys.boot_completed` returns `1` | N/A — `ENV_FAILURE` if not connected | Already booted | None |
| **Android Emulator** | Same getprop check, plus `adb -s {serial} shell input keyevent 82` to wake/dismiss lock | `emulator -avd $ANDROID_AVD -no-snapshot-load -no-boot-anim &` (add `-no-window` if `headless=true`) | Poll getprop every 2s up to `emulatorBootTimeoutMs` | `adb -s {serial} emu kill` |
| **iOS Simulator** | `xcrun simctl list booted` returns line containing `$IOS_SIM_UDID` | `xcrun simctl boot $IOS_SIM_UDID && open -a Simulator` (skip `open` if `headless=true`) | Poll `xcrun simctl getenv $IOS_SIM_UDID HOME` every 2s up to `simulatorBootTimeoutMs` | `xcrun simctl shutdown $IOS_SIM_UDID` |

### 6.3 Appium server lifecycle

1. Probe: `GET http://localhost:4723/status` (or value from `mobile.appium.url`).
2. If 200 OK → reuse; `appiumStartedByRunner = false`.
3. If port in use but not Appium (response not Appium-shaped) → `ENV_FAILURE` "Port 4723 held by non-Appium process."
4. If port free and `mobile.appium.autoStart == true` → spawn `appium &` with stdout to `output/test-results/appium-cycle{N}.log`. Wait up to `mobile.appium.startupTimeoutMs` for `/status` 200. `appiumStartedByRunner = true`.
5. If port free and `autoStart == false` → `ENV_FAILURE` "Appium not running and autoStart disabled."

---

## 7. Edge Cases (Phase 1)

### 7.1 General edge cases

| # | Edge case | Mitigation |
|---|-----------|------------|
| 1 | Wdio hangs indefinitely (no exit, no output for >5 min) | Bounded `maxRunDurationMs`; on timeout, kill child process tree, emit `INFRA_FAILURE` reason `"wdio_hung"` |
| 2 | Multiple ADB devices connected, no `ANDROID_DEVICE` env var | `ENV_FAILURE` listing all serials — never guess |
| 3 | Appium already running on 4723 | Health-check via `/status`. If healthy, reuse; if held by non-Appium, `ENV_FAILURE`. Track ownership in marker |
| 4 | Cycle marker collision when agent restarts mid-cycle | Atomic `.tmp` → rename. Agent always reads the most recent marker matching `cycle{N}-done.json` |
| 5 | Spec has multiple `it()` blocks; partial pass | Marker carries `{total, passed, failed, firstFailure}`. Agent diagnoses each failure independently per existing §4.4a in `executor.md` |
| 6 | `cycle{N}-raw.txt` grows huge (10MB+) | Parallel `cycle{N}-tail.txt` written by runner. Agent reads tail by default; raw on demand only |
| 7 | App stale state between cycles | Already handled by wdio.conf.ts `beforeSuite` hook (`terminateApp + activateApp`). Runner does NOT duplicate this — single source of truth |
| 8 | Healer agent re-runs tests post-fix | Healer must use `mobile-runner.js` (not raw wdio). Confirm Healer's behavior during build before editing |
| 9 | Reviewer counts `<!-- CYCLE_COMPLETE: N of M -->` markers | Agent (not runner) writes these. Runner writes JSON marker; agent writes report marker after parsing. Existing Reviewer contract preserved |
| 10 | iOS path | Phase 1 supports `PLATFORM=ios` simulator only. Physical iOS = Phase 1.5. Document the gap in `executor-mobile.md` |
| 11 | CI/cloud devices (BrowserStack, Sauce) | Phase 1 = local Appium only. Cloud detection emits `ENV_FAILURE`. Phase 2 |

### 7.2 Emulator/simulator-specific edge cases

| # | Edge case | Mitigation |
|---|-----------|------------|
| 12 | AVD/UDID name in env var doesn't exist | Pre-flight: `emulator -list-avds` / `xcrun simctl list devices available`. `ENV_FAILURE` with available list |
| 13 | Emulator process running but stuck on boot animation (offline in adb) | Boot-completed poll catches this — `sys.boot_completed != 1` after `emulatorBootTimeoutMs` → kill + retry once → `INFRA_FAILURE` |
| 14 | HAXM/Hyper-V/KVM not configured (emulator launches in software mode → 10x slower) | Optional pre-check: `emulator -accel-check`. If software mode, write `accelerationStatus: "software"` warning into marker. Don't fail — some users intentionally run software |
| 15 | Multiple emulators running, no `ANDROID_DEVICE` | Same as edge case 2 — `ENV_FAILURE` listing serials |
| 16 | Snapshot-restored emulator in unexpected state (Play Store sign-in, system update prompt) | Runner does NOT try to dismiss — that is `PopupGuard`'s job in the test. Runner only confirms boot-completed and lock dismissed |
| 17 | Simulator booted but Simulator.app not visible | `open -a Simulator` after boot is idempotent — call always when runner auto-started the sim. Cosmetic but removes confusion |
| 18 | Emulator/simulator headless mode in CI | Respect `mobile.target.headless = true` env: emulator gets `-no-window`, simulator skips `open -a Simulator` |
| 19 | Emulator cold-boot vs snapshot-load | Default `useSnapshotForEmulator = false` for deterministic state. Set `true` for production CI that wants fast boot |
| 20 | Emulator/simulator survives across cycles by design — but a hung session needs a hard reset | `mobile.target.resetOnInfraFailure = true` (default): on `INFRA_FAILURE` retry, wipe target via `adb emu kill` + relaunch instead of just retrying the wdio session |

### 7.3 Cloud-specific edge cases (Phase 2 — documented for completeness)

C1–C17: see Phase 2 spec when written. Key signals: app upload failure, auth failure, concurrency limit, device queue timeout, tunnel daemon required, vendor session killed, billing budget exceeded, vendor capability syntax differences, network latency, build name collision, vendor session URL retrieval, regional outage, session creation flakiness, region selection, AWS DF different model, app upload quota.

---

## 8. Future Phases

| Phase | Scope | Trigger to build |
|-------|-------|------------------|
| 1.5 | Physical iOS device support | When a team needs it; Xcode + ideviceinstaller integration |
| 2 | Cloud vendors: BrowserStack, Sauce Labs, LambdaTest. Tunnel daemons. Billing tracking. New `BUDGET_EXCEEDED` marker status. Edge cases C1–C17 | When CI integration with cloud devices is needed |
| 3 | AWS Device Farm (different model: bundle upload, async results retrieval via AWS SDK, no live driver) | If a customer requires it |

---

## 9. Implementation Sequence

Build in this order. Each step is independently testable.

### Step 1 — `scripts/mobile-runner.js` (standalone)

Build the runner first. Test it manually by invoking from the command line on a real scenario. It is fully decoupled from the agent at this stage — your coworker could run it manually today and avoid every issue we hit in the original session.

**Definition of done:**
- Runs against an Android emulator and produces a `cycle1-done.json` marker for both passing and failing scenarios
- Runs against an iOS simulator and produces a marker
- Auto-starts emulator if AVD is named but not running
- Health-checks Appium and auto-starts if missing
- Writes `cycle1-raw.txt` and `cycle1-tail.txt` correctly
- Survives wdio hangs (timeout enforced)
- Always exits 0
- Writes marker atomically

### Step 2 — `agents/core/executor-mobile.md`

Write the agent instructions referencing the runner. Use Pattern 1 (polling) for completion detection.

**Definition of done:**
- Cycle pattern is INVOKE_RUNNER → POLL_MARKER → CLASSIFY → DIAGNOSE_OR_RETRY → FIX
- Status taxonomy drives all branching (no other decision points)
- §4.4 Diagnostic Gate is page-source-XML based, not DOM based
- Hard-rule prohibition on reading `output/test-results/*` before runner has completed for the current cycle
- Cycle counter rules per §5.4 of this spec

### Step 3 — Agent wrappers (Claude Code + Copilot)

`agents/claude/executor-mobile.md` and `.github/agents/executor-mobile.agent.md`. Thin files. Mirror the existing executor wrappers.

### Step 4 — Type registry and orchestrator updates

Update `agents/shared/type-registry.md` and `agents/core/orchestrator.md` to dispatch mobile/mobile-hybrid to the new Executor.

### Step 5 — Remove mobile content from `executor.md`

After steps 1–4 are validated end-to-end, remove mobile-specific sections from `agents/core/executor.md`. Single source of truth.

### Step 6 — Healer dependency check

Read `agents/core/healer.md`. If Healer re-runs tests, route those re-runs through `mobile-runner.js`. If Healer only edits code without re-running, no change needed. **Verify before editing — don't assume.**

### Step 7 — `framework-config.json` schema update

Add the `mobile.runner`, `mobile.target`, `mobile.appium` blocks per §5.5.

---

## 10. Validation Plan

### 10.1 Runner-level validation (after Step 1)

| Test | Setup | Expected marker |
|------|-------|------------------|
| Happy path: passing test on running emulator | Emulator booted, Appium running, simple passing spec | `status: TEST_PASS`, `cycle: 1`, all artifacts present |
| Test failure | Same setup, deliberately broken spec | `status: TEST_FAILURE`, `firstFailure` populated, page-source XML present |
| Emulator auto-start | Set `ANDROID_AVD`, no emulator running | `target.startedByRunner: true`, `bootDurationMs > 0` |
| Appium auto-start | Appium not running, `mobile.appium.autoStart: true` | `appium.startedByRunner: true` |
| No device | adb devices empty | `status: ENV_FAILURE`, `failureReason: "No Android device detected"` |
| Invalid AVD name | Set `ANDROID_AVD` to nonexistent AVD | `status: ENV_FAILURE`, `failureReason` lists available AVDs |
| Wdio hang | Spec with infinite loop | `status: INFRA_FAILURE`, `failureReason: "wdio_hung"` after `maxRunDurationMs` |
| Cleanup | Set `cleanupOnCycle1: true`, run cycle 1 with prior session's `cycle*-raw.txt` files present | All prior `cycle*` files removed before cycle 1 starts |
| Atomic marker | Read marker file via watcher during runner execution | Never observe a `.json` file; always `.json.tmp` until rename |
| Exit code | Run all the above | Always exits 0 |

### 10.2 Agent-level validation (after Step 2)

| Test | Setup | Expected behavior |
|------|-------|--------------------|
| Cold start | Empty `test-results/` | Agent invokes runner without reading any test-results files first |
| Stale artifacts present | Prior session's `last-run-parsed.json` and `error-context.md` present | Agent does NOT read them; invokes runner; runner cleans them on cycle 1 |
| TEST_FAILURE → fix → TEST_PASS | Failing spec, reasonable fix | Cycle 1 fails, agent diagnoses from page-source XML, applies fix, cycle 2 passes |
| INFRA_FAILURE handling | Kill Appium between cycles | Agent does NOT increment cycle counter; retries; if Appium recovers, continues |
| ENV_FAILURE escalation | No device connected | Agent reads marker, writes report explaining missing device, escalates |
| Two INFRA_FAILUREs in a row | Persistent Appium issue | Agent escalates with infra log on second failure |
| Cycle counter respected | `executor.maxCycles: 3`, persistent failure | Agent terminates after exactly 3 `TEST_FAILURE` cycles, regardless of how many INFRA retries |

### 10.3 End-to-end validation

Re-run the original failing scenario from the session that prompted this redesign (`output/tests/mobile/connect-mobile-InTransit-tab.spec.ts`) on the same Android device. Expected: agent self-drives end-to-end without manual nudges, completes Cycle 1 (or however many cycles the original needed), and produces a clean executor report.

---

## 11. Open Questions to Resolve During Build

These are deliberately deferred — they need a quick check during implementation, not during spec discussion.

1. **Healer test re-runs?** Read `agents/core/healer.md`. Does Healer invoke wdio after applying fixes? If yes, route through `mobile-runner.js`. If no, leave alone.
2. **Existing wdio.conf.ts hooks.** Does the current `templates/config-mobile/wdio.conf.ts` `afterTest` hook write `page-source-{N}.xml` and `test-failed-{N}.png` with the cycle suffix? If not, update the template (or have the runner inject the cycle number via env var).
3. **Marker file write location.** Confirm `output/test-results/` exists before write. Runner should `mkdir -p` defensively.
4. **`tree-kill` dependency.** Killing the wdio process tree on Windows requires `tree-kill` or PowerShell `Stop-Process -Force` with descendants. Pick one that works cross-platform; document in `package.json` dependencies if adding.
5. **Test-results-parser compatibility.** Existing `scripts/test-results-parser.js` is web-shaped (Playwright JSON reporter). Does it parse WDIO Mocha JSON output correctly? If not, either extend it or add a sibling `scripts/mobile-test-results-parser.js`.
6. **Multiple `it()` block aggregation.** `parsedJson` already structures pass/fail per-test. Confirm runner's `firstFailure` extraction picks the first chronological failure, not the first by sort order.
7. **iOS device selection.** When `xcrun simctl list booted` returns multiple sims, pick the first or fail? Recommend: prefer `IOS_SIM_UDID` env var; if multiple booted and no env var, `ENV_FAILURE` with list (parallel to Android multi-device rule).
8. **Appium auto-start cross-platform.** `appium &` on Windows requires `start /B` or PowerShell `Start-Process`. Pick a Node.js spawn-based approach that doesn't depend on shell syntax.

---

## 12. Glossary

| Term | Meaning |
|------|---------|
| **Cycle** | One complete RUN → PARSE → DIAGNOSE → FIX iteration. Counter increments only on TEST_PASS / TEST_FAILURE markers. |
| **Marker file** | `cycle{N}-done.json` — the deterministic completion signal written by mobile-runner.js. The contract between runner and agent. |
| **Pattern 1** | Marker-file polling. The agent polls for the marker file every ~30s instead of relying on Copilot's runCommand notification. |
| **Status** | The `status` field of the marker. One of TEST_PASS / TEST_FAILURE / INFRA_FAILURE / ENV_FAILURE / RUNNER_CRASH. Drives all agent branching. |
| **Target** | The mobile execution environment: physical device, emulator, simulator, or cloud. |
| **Page source XML** | Appium's UI hierarchy dump — the mobile equivalent of a DOM snapshot. Captured at first failure for the Diagnostic Gate. |
| **Tail log** | `cycle{N}-tail.txt` — last 200 lines + every error/fail line from the raw wdio output. Read by default; raw read on demand only. |
| **Atomic write** | Write to `.tmp` then `Move-Item` (rename). Guarantees agent never reads a half-written marker. |
| **Self-driving** | Agent completes the full cycle without manual user intervention. The redesign goal. |

---

## Appendix A — Mapping decisions to root causes

| Root Cause | How Phase 1 closes it |
|-----------|------------------------|
| RC-1 (Copilot runCommand wrong for long commands) | Pattern 1 polling. Each poll is a fast runCommand; long-running execution is delegated to the runner script which the agent doesn't have to wait on synchronously. |
| RC-2 (Cycle architecture assumes fast feedback) | New mobile-specific cycle pattern with explicit polling + status-driven branching. |
| RC-3 (Framework instruction gaps) | `executor-mobile.md` explicitly forbids reading `test-results/*` before runner completes. Mobile-specific Diagnostic Gate. Mobile-specific failure signatures. |
| RC-4 (Sonnet 4.6 optimization tendency) | Hard-rule prohibitions framed as failure conditions. Status taxonomy removes the optimization opportunity (agent can't "save a cycle" because cycles only count for real test runs). |
| RC-5 (Operational hygiene) | Runner does cleanup automatically on cycle 1. Atomic writes prevent half-state. Cycle-suffixed filenames prevent collision. |

## Appendix B — Files referenced by this spec

For the implementing Claude Code session, here is every framework file referenced in this spec. Read each before editing:

- `agents/core/executor.md` — current Executor (will lose mobile sections)
- `agents/core/orchestrator.md` — pipeline dispatcher
- `agents/core/healer.md` — confirm test re-run behavior
- `agents/shared/type-registry.md` — per-agent type lookup tables
- `agents/shared/guardrails.md` — ownership boundaries
- `agents/shared/keyword-reference.md` — code patterns
- `agents/claude/executor.md` — Claude Code wrapper template
- `.github/agents/executor.agent.md` — Copilot wrapper template
- `agents/core/code-generation-rules.md` §16 — mobile code patterns (Builder side; informs what runner expects)
- `templates/config-mobile/wdio.conf.ts` — wdio config (may need afterTest hook updates)
- `templates/core-mobile/base-screen.ts` — Screen Object base (no changes expected)
- `scripts/test-results-parser.js` — verify WDIO compatibility
- `framework-config.json` — schema additions

---

**End of specification.**
