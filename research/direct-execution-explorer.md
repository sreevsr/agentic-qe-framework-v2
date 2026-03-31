# Research: Direct Execution Explorer — The Only Agent You Need

## Vision Statement

**One agent. No code. Any GUI.**

The Explorer reads a scenario (natural language steps), opens the app, executes every step exactly like a human would, verifies every assertion, and produces a PASS/FAIL test report. No code generated. No selectors maintained. No other agents needed.

**Speed target:** If Playwright runs the automationexercise-trial spec in 14 seconds, the Explorer must complete the same 77-step flow in under 42 seconds (3x).

**Cost target:** Minimal token consumption — LLM inference only when judgment is needed, not for every step.

**Platform target:** Any GUI — SAP, Salesforce, SaaS web, mobile web, mobile app, modern web app, legacy web app, desktop app. Exactly like a human does it, but faster.

**What we eliminate:** Scout, Builder, Executor, Reviewer, Healer. All of them. The Explorer IS the test.

---

## Why This Must Happen (Our Experience)

From building and running the Agentic QE Framework v2:

| What we built | What happened |
|--------------|---------------|
| Scout (element discovery) | 4 iterations to filter noise, still missed 11 of 15 elements on MUI app |
| Builder (code generation) | 13 minutes to produce code, 16 of 28 steps were test.fixme() |
| Executor (test execution + healing) | 10 cycles, 3 VS Code crashes, overwrote locator files, still didn't pass |
| Reviewer (quality audit) | Good output but reviewing code that doesn't work is pointless |
| Healer (code repair) | Never reached — pipeline broke before getting here |

**Total time:** 2+ hours for a 29-step scenario. **Result:** Test still not passing.

**Meanwhile:** The Explorer ran the same 29 steps in 8 minutes, verified every single one, and produced a perfect enriched.md with 28/28 steps verified. It just worked.

**The conclusion is obvious:** The Explorer already IS the test execution. We're wrapping it in unnecessary code generation layers that add complexity, cost, and failure points. Strip them all away.

---

## How Today's Explorer Works (What's Right)

```
Explorer reads scenario step: "Click User Photos in the main navigation"
  ↓
Explorer takes MCP snapshot of current page
  ↓
Explorer sees the elements, finds "User Photos" link
  ↓
Explorer clicks it via MCP
  ↓
Explorer takes another snapshot to verify navigation happened
  ↓
Records: Step 3 — VERIFIED
  ↓
Moves to next step
```

**This is exactly how a human tester works.** Read the step, look at the screen, do the action, check the result. No selectors, no code, no maintenance.

**What's wrong today:**
1. **Every step requires LLM inference** — even "Click the button" needs the LLM to reason about which button. ~1-2 seconds per step.
2. **Every snapshot burns tokens** — accessibility tree snapshots are 2-5K tokens each. 77 steps × 2 snapshots = ~300K tokens.
3. **Explorer produces enriched.md, not a test report** — it documents what happened but doesn't give a PASS/FAIL verdict that CI/CD can consume.
4. **No self-healing loop** — if a step fails, Explorer flags it and moves on. It doesn't retry with alternatives.

---

## The Speed Problem: Why 8 Minutes Instead of 42 Seconds

**Breakdown of today's Explorer for 28 steps:**

| Activity | Time per step | Total for 28 steps |
|----------|--------------|-------------------|
| LLM reads step + plans action | ~2000ms | 56s |
| MCP snapshot (pre-action) | ~500ms | 14s |
| MCP action (click/fill/navigate) | ~300ms | 8.4s |
| MCP snapshot (post-action verify) | ~500ms | 14s |
| LLM reasons about result | ~1500ms | 42s |
| File writes (enriched.md, report) | ~200ms | 5.6s |
| **Total** | **~5000ms** | **~140s (~2.3 min)** |

But actual time was **8 minutes** — the overhead is from:
- Reading 8+ instruction files before starting (~2 min)
- Context management / compaction pauses (~1 min)
- Redundant snapshots (taking snapshot when page hasn't changed) (~1 min)
- LLM reasoning about enriched.md format (~2 min)

**If we optimize:**

| Optimization | Saving |
|-------------|--------|
| Skip pre-action snapshot when page hasn't changed | -14s |
| Pre-compile action plan (no LLM per action step) | -56s |
| Use cached assertion patterns | -30s |
| Skip enriched.md generation (produce report directly) | -120s |
| Reduce instruction file reads | -120s |
| **Optimized total** | **~42s** |

**The 3x target is achievable** by eliminating redundant LLM calls and unnecessary file I/O.

---

## Research Landscape (March 2026)

### What Exists Today

| Tool/Research | Approach | Speed | Accuracy | Code Generated? |
|--------------|----------|-------|----------|----------------|
| **Playwright Test Agents** (Microsoft) | Planner → Generator → Healer | Slow (generates code) | High (verified selectors) | YES — spec files |
| **BrowserUse** (Open Source) | Natural language → browser action | ~89.1% WebVoyager | Good | NO |
| **Stagehand v3** (Browserbase) | AI-native CDP automation | 44% faster than Playwright | Good | NO |
| **SeeAct-ATA / PinATA** (Academic) | LLM executes test steps from NL | Slow (LLM per step) | 60% verdicts, 94% specificity | NO |
| **testRigor** (Commercial) | NLP parser executes plain English | Fast (pre-compiled NLP) | High (production use) | NO |
| **Skyvern** (Commercial) | LLM + computer vision | Medium | 85.85% WebVoyager | NO |
| **Our Explorer** (current) | LLM + MCP Playwright | 8 min / 28 steps | 100% (verified) | NO (produces enriched.md) |

**Key insight from the landscape:**
- **BrowserUse, Stagehand, Skyvern** prove that codeless browser automation works at 85-89% accuracy
- **testRigor** proves it works in production at enterprise scale
- **PinATA** proves that test-specific assertion handling from natural language is feasible (94% specificity)
- **Stagehand** proves that bypassing traditional automation layers (talking directly to CDP) makes it 44% faster
- **Our Explorer** already achieves 100% accuracy — the problem is SPEED, not accuracy

### The Academic Paper That Validates Our Vision

**"Are Autonomous Web Agents Good Testers?"** (arxiv 2504.01495, April 2025)

Key findings:
- Adapted SeeAct (autonomous web agent) into an Autonomous Test Agent (ATA)
- Modified the prompt to execute test steps AND verify assertions
- PinATA achieved 60% correct verdicts, 94% specificity
- **The concept works** — an LLM can execute tests from natural language and give verdicts
- **The accuracy needs improvement** — 60% is not production-ready
- **Our Explorer already beats this** — 100% accuracy on verified steps

### Karpathy's Autoresearch: The Execution Model

**Core loop:** Modify → Run → Evaluate → Keep/Discard → Repeat.

Applied to our Explorer:
```
metric = "steps passed / total steps"

Step fails → Explorer tries alternative approach
  → If step now passes → KEEP the approach (save to app-context)
  → If step still fails → DISCARD, try another alternative
  → Max 3 alternatives per step, then mark as FAILED
```

This is the self-healing loop our Explorer is missing. Not code healing — execution healing. The Explorer adapts its approach in real-time, like a human who tries clicking a different button when the first one doesn't work.

---

## Proposed Architecture: Direct Execution Explorer

### The Design

```
INPUT:
  scenario.md (natural language test steps)
  app-context.md (learned patterns from previous runs — optional)

EXECUTION:
  Explorer opens browser
  FOR EACH step:
    ├── Classify step type (ACTION / VERIFY / CAPTURE / SCREENSHOT / CALCULATE)
    │
    ├── ACTION (click, fill, navigate, select):
    │   ├── Look at page (accessibility snapshot)
    │   ├── Find the target element described in the step
    │   ├── Execute the action
    │   ├── If fails → try alternative (Autoresearch loop, max 3 attempts)
    │   └── Record: PASS or FAIL + what worked
    │
    ├── VERIFY / VERIFY_SOFT (assertion):
    │   ├── Look at page (accessibility snapshot)
    │   ├── Evaluate: does the page state match the assertion?
    │   └── Record: PASS or FAIL + evidence
    │
    ├── CAPTURE (read value):
    │   ├── Find the element, read its text
    │   └── Store in memory for later steps
    │
    ├── SCREENSHOT:
    │   └── page.screenshot() → attach to report
    │
    └── CALCULATE:
        └── Arithmetic on captured values — no browser needed

OUTPUT:
  Test execution report (PASS/FAIL per step, screenshots, timing)
  Updated app-context.md (new patterns discovered)
```

### Speed Optimizations

| Optimization | How | Impact |
|-------------|-----|--------|
| **Pre-classify steps** | Before execution, classify all steps as ACTION/VERIFY/CAPTURE/SCREENSHOT/CALCULATE. No LLM needed for classification — keyword matching. | Saves ~1s per step |
| **Skip snapshot when unnecessary** | SCREENSHOT, CALCULATE steps don't need a snapshot. Consecutive ACTION steps on same page don't need re-snapshot. | Saves ~500ms per skipped snapshot |
| **Batch LLM calls** | For VERIFY steps, batch the assertion check with the action result: "I clicked X and now the page shows Y — does this satisfy the assertion?" One call instead of two. | Saves ~1s per VERIFY step |
| **Cache element locations** | If the Explorer found "User Photos" link at position X in the accessibility tree, cache it for the same page. Don't re-scan the entire tree. | Saves ~200ms per cached lookup |
| **Use accessibility tree, never full DOM** | Accessibility tree is ~2K tokens. Full DOM is ~20-50K tokens. 10-25x cheaper per snapshot. | Saves 80% of token cost |
| **Stream LLM responses** | Don't wait for full response. As soon as the LLM identifies the target element, start executing the action while the LLM finishes its reasoning. | Saves ~500ms per step |

### How It Handles Any GUI

The Explorer doesn't know or care about the UI framework. It sees the **accessibility tree** — the same tree a screen reader sees. This is framework-agnostic:

| GUI Type | Accessibility Tree | Explorer's View |
|----------|-------------------|----------------|
| SAP Fiori | ARIA roles + SAP-specific semantics | Buttons, inputs, tables, dialogs |
| Salesforce Lightning | Shadow DOM + ARIA | Same — buttons, inputs, tables |
| SaaS web app (React/Vue/Angular) | Standard ARIA or semantic HTML | Same |
| Mobile web (responsive) | Same as desktop, smaller viewport | Same |
| Mobile app (Appium) | UIAutomator/XCUITest accessibility tree | Buttons, inputs, text views |
| Desktop app (WinAppDriver) | Windows UI Automation tree | Buttons, inputs, list views |
| Legacy web (no ARIA) | Tag-based fallback | Links, inputs, buttons by tag/text |

**The accessibility tree IS the universal abstraction layer.** Every platform has one. The Explorer reads it the same way regardless of framework.

---

## Token Cost Analysis

### Today (v2 Pipeline: Scout → Explorer → Builder → Executor)

| Agent | Tokens | Cost (Claude Opus @ $15/M input, $75/M output) |
|-------|--------|-----------------------------------------------|
| Explorer (8 min, 28 steps) | ~150K | ~$3.50 |
| Builder (13 min) | ~100K | ~$2.50 |
| Executor (10 cycles) | ~200K | ~$5.00 |
| Reviewer | ~80K | ~$2.00 |
| **Total** | **~530K** | **~$13.00** |

### Proposed (Direct Execution Explorer only)

| Phase | Tokens | Cost |
|-------|--------|------|
| Step classification (keyword match) | 0 | $0 |
| ACTION steps (28 × ~2K snapshot) | ~56K | ~$0.84 |
| VERIFY steps (11 × ~3K snapshot + reasoning) | ~33K | ~$1.50 |
| Report generation | ~5K | ~$0.40 |
| **Total** | **~94K** | **~$2.74** |

**5.6x cheaper. 10-20x faster.**

---

## Research Questions

1. **What is the minimum viable LLM for VERIFY assertions?** Can a small model (Haiku, GPT-4o-mini) handle "is this heading visible on the page?" assertions, or do we need Opus/Sonnet for enterprise app complexity?

2. **How reliable is the accessibility tree across platforms?** SAP, Salesforce, and legacy apps may have poor accessibility. What's the fallback when the tree is incomplete?

3. **Can we pre-compile an action plan that needs ZERO LLM calls for ACTION steps?** If the scenario says "Click Submit button" and the accessibility tree has exactly one button named "Submit" — no LLM reasoning needed. Just click it.

4. **What is the self-healing success rate?** When a step fails and the Explorer tries alternatives (Autoresearch loop), how often does it find a working approach within 3 attempts?

5. **How to handle stateful test data?** The Explorer generates a unique email per run. Without a spec file, where does this logic live? In the scenario.md? In a test-data.json? In the Explorer's runtime memory?

6. **Can the Explorer run in CI/CD without a headed browser?** Headless mode with accessibility tree should work. But MCP requires a browser instance — can it be headless?

7. **How to parallelize?** Can the Explorer run multiple scenarios simultaneously? Each gets its own browser context. Token cost is per-scenario.

8. **What report format replaces Playwright's HTML report?** We need: step-by-step PASS/FAIL, screenshots, timing, annotations, CI/CD integration (JUnit XML? Allure?).

---

## Implementation Strategy

### Phase 1: Proof of Concept (1-2 weeks)
**Goal:** Direct Execution Explorer runs automationexercise-trial scenario in under 60 seconds.

- Strip Explorer to minimum: read scenario, execute actions, verify assertions, produce report
- No enriched.md generation, no app-context updates, no page mapping
- Measure: time, pass rate, token cost, LLM calls
- Compare against: Playwright spec (14s), current Explorer (8 min)

### Phase 2: Speed Optimization (1 week)
**Goal:** Hit the 42-second (3x) target.

- Pre-classify steps (zero LLM for action type detection)
- Skip redundant snapshots
- Cache element locations within same page
- Batch LLM calls for verify steps
- Measure: time reduction per optimization

### Phase 3: Self-Healing Loop (1-2 weeks)
**Goal:** Explorer recovers from failures without human intervention.

- Apply Autoresearch loop: fail → try alternative → keep/discard
- Build app-context from discovered patterns
- Handle: loading spinners, modals, popups, SSO transitions, session timeouts
- Measure: recovery rate, attempts per step

### Phase 4: Enterprise Validation (2 weeks)
**Goal:** Works on real customer apps.

- Test on: devunify (Fluent UI + MUI), epicview (Power Apps), automationexercise (Bootstrap)
- Handle: SAP, Salesforce, custom enterprise UIs
- Handle: SSO/Kerberos/LDAP auth flows
- Measure: success rate across different UI frameworks

### Phase 5: Multi-Platform (future)
**Goal:** Same Explorer works on mobile and desktop.

- Mobile: Appium MCP for native apps
- Desktop: WinAppDriver or similar
- Cross-browser: Chrome, Firefox, Safari, Edge
- Measure: platform-specific success rates

---

## References

### Academic Research
- [Are Autonomous Web Agents Good Testers?](https://arxiv.org/abs/2504.01495) — SeeAct-ATA, PinATA, 60% accuracy, 94% specificity
- [An Illusion of Progress? Assessing the Current State of Web Agents](https://arxiv.org/html/2504.01382v4)
- [Building Browser Agents: Architecture, Security, and Practical Solutions](https://arxiv.org/html/2511.19477v1)

### Tools and Frameworks
- [BrowserUse](https://github.com/browser-use/browser-use) — 89.1% success on WebVoyager, natural language → browser action
- [Stagehand v3](https://github.com/browserbase/stagehand) — 44% faster, AI-native CDP automation
- [Playwright Test Agents](https://playwright.dev/docs/test-agents) — Microsoft's Planner/Generator/Healer
- [Skyvern](https://www.skyvern.com/) — LLM + computer vision, 85.85% on WebVoyager
- [testRigor](https://testrigor.com/) — Production codeless testing from plain English
- [Karpathy Autoresearch](https://github.com/karpathy/autoresearch) — Self-improving experiment loop

### Industry Analysis
- [The Agentic Browser Landscape in 2026](https://nohacks.co/blog/agentic-browser-landscape-2026)
- [Playwright AI Ecosystem 2026](https://testdino.com/blog/playwright-ai-ecosystem/)
- [Stagehand vs Browser Use vs Playwright 2026](https://www.nxcode.io/resources/news/stagehand-vs-browser-use-vs-playwright-ai-browser-automation-2026)
- [The State of AI & Browser Automation in 2026](https://www.browserless.io/blog/state-of-ai-browser-automation-2026)
- [Benchmarking AI Agent Architectures for Enterprise Test Automation](https://www.mabl.com/blog/benchmarking-ai-agent-architectures-enterprise-test-automation)

### Performance Data
- Playwright: 290ms per action average
- BrowserUse: 89.1% success rate on WebVoyager
- Stagehand v3: 44% faster than traditional automation
- PinATA: 60% correct verdicts, 94% specificity
- Skyvern: 85.85% on WebVoyager
- Our Explorer: 100% accuracy, 8 min / 28 steps (needs 10-20x speedup)

---

## Phase 1 Results (2026-03-31)

### Execution Summary

| Metric | Target | Actual |
|--------|--------|--------|
| Scenario | automationexercise-trial (77 steps) | automationexercise-trial (77 steps) |
| Pass rate | 100% | **100% (77/77)** |
| Time | <60s | **335s (5m 35s)** — missed target |
| Time (excl browser install) | <60s | **~245s (~4 min)** — still missed |
| Self-heals | N/A | 1 (download handling) |
| Snapshots taken | ~67 (predicted) | **~10 (batched)** |
| Screenshots | 4 | 4 |

### What Worked

1. **100% pass rate** — every step executed correctly, including complex flows (signup, shopping, checkout, payment, invoice download, logout)
2. **Snapshot batching** — Products page snapshot read once, used for 20 steps (4 products × 5 steps each). Checkout snapshot read once, used for 14 VERIFY steps.
3. **fill_form batching** — 7 address fields filled in 1 MCP call. 5 payment fields filled in 1 MCP call.
4. **Self-healing worked** — Download step failed with `require()` in browser context, self-healed with `saveAs()` approach on attempt 2.
5. **No instruction bloat** — Agent read scenario + .env only. No quality-gates.md, no guardrails.md, no type-registry.md.

### What Didn't Work (Why We Missed the 60s Target)

**The bottleneck is NOT LLM reasoning. It's MCP round-trip latency.**

| Bottleneck | Impact | Why |
|-----------|--------|-----|
| MCP tool call latency | ~3-5s per call × ~30 calls = ~90-150s | Each tool call is a network round-trip to the MCP server |
| Snapshot token consumption | ~10K tokens per Products page snapshot | Accessibility tree includes ALL 34 products with ALL their refs |
| Sequential execution | Cannot pipeline click+snapshot | MCP protocol is request-response, not streaming |
| Conversational overhead | LLM receives full snapshot, processes it, formulates next action | Even when the action is obvious (click "Submit"), the LLM still processes the full snapshot |

**The 60s target is physically impossible with MCP as the browser interface.** Even if LLM reasoning were instant, 30 MCP round-trips at 3-5s each = 90-150s minimum.

### Comparison Table

| Metric | Playwright Spec | v2 Explorer | Direct Executor |
|--------|----------------|-------------|-----------------|
| Time | 14s | ~8 min | 5m 35s |
| Pass rate | 100% | 100% | 100% |
| Output | Test results | enriched.md | PASS/FAIL report |
| LLM calls | 0 | ~56 | ~30 |
| Snapshots | 0 | ~56 | ~10 |
| Self-heals | 0 | 0 | 1 |
| Files read before start | 0 | 8+ | 2 (scenario + .env) |
| Code generated | Pre-written | No | No |

### Key Insights

1. **MCP is the bottleneck, not the LLM.** The LLM identified and executed every action correctly on the first attempt (except download). The time is spent waiting for MCP responses.

2. **Snapshot batching is the biggest optimization.** Instead of taking 67 snapshots (as predicted by the classifier), we took ~10. Reading one snapshot and processing multiple steps from it saved 57 × ~3s = ~170s.

3. **The 60s target requires a different execution model.** MCP request-response cannot achieve it. Options:
   - **Code generation + Playwright direct execution** — generate a script, run it natively (what v2 Builder does)
   - **CDP direct access** — bypass MCP, talk to Chrome DevTools Protocol directly (what Stagehand does)
   - **Hybrid** — LLM generates Playwright code snippets on-the-fly, executes them natively (no MCP round-trips)

4. **The "no code" vision has a speed ceiling.** As long as every browser action requires an LLM decision, we're bounded by LLM inference time + communication latency. The 14s Playwright spec is fast because it's pre-compiled — no decisions at runtime.

### Revised Strategy

The Phase 1 POC proves the concept works (100% accuracy, self-healing, batched snapshots) but reveals that the 3x speed target (42s) requires a fundamentally different execution path. Three candidate approaches for Phase 2:

**Approach A: Hybrid Code Generation**
- LLM reads scenario + first snapshot → generates a Playwright script
- Script runs natively (14s-class speed)
- If script fails → LLM reads error + snapshot → patches the script
- Autoresearch loop: generate → run → fix → run

**Approach B: Pre-compiled Action Plans**
- Step classifier + first snapshot → deterministic action plan (element refs + actions)
- Execute plan via MCP without LLM per step
- Only invoke LLM for VERIFY steps (assertions need judgment)
- Estimated: ~30s for actions + ~30s for verifications = ~60s

**Approach C: CDP Direct Access**
- Replace MCP with direct CDP connection
- Eliminates MCP protocol overhead
- Still needs LLM for element identification
- Similar to Stagehand's approach

### Files Created

| File | Purpose |
|------|---------|
| `scripts/step-classifier.js` | Zero-LLM step classification (keyword matching) |
| `agents/core/direct-executor.md` | Lean agent instructions for Direct Execution Explorer |
| `agents/report-templates/direct-executor-report.md` | PASS/FAIL report template |
| `output/reports/direct-executor-report-automationexercise-trial.md` | Phase 1 execution report |
| `output/screenshots/account-created.png` | Screenshot evidence |
| `output/screenshots/cart-with-all-items.png` | Screenshot evidence |
| `output/screenshots/order-confirmed.png` | Screenshot evidence |
| `output/screenshots/invoice-verified.png` | Screenshot evidence |
