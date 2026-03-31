# Phase 1 Findings & Next Steps — Research Synthesis

## Date: 2026-03-31

---

## Three Questions, Three Research Streams

### Q1: Can we replace MCP with something faster?
### Q2: What visual techniques exist for GUI automation?
### Q3: How do you run tests repeatedly without code?

---

## FINDING 1: MCP Is the Wrong Tool for Test Execution

### The Real Bottleneck (it's worse than we thought)

MCP Playwright has **three compounding bottlenecks**, not just round-trip latency:

| Bottleneck | Impact | Data |
|-----------|--------|------|
| **Full accessibility tree serialization** | ~50-70% of the problem | Enterprise page: 138K tokens per snapshot |
| **O(n²) context accumulation** | The killer | 10-step flow generates ~7.6M input tokens (all prior snapshots stay in context) |
| **Double network hop** | Adds latency per call | LLM → MCP server → Playwright → browser (vs direct CDP) |

**Key stat:** MCP burns ~114K tokens per test vs Playwright CLI's ~27K (4.2x overhead). On complex pages like Amazon, MCP uses ~52K tokens per snapshot vs CLI's ~1.2K (43x difference).

### Alternatives That Already Exist

| Tool | How | Token Reduction | Speed Gain |
|------|-----|----------------|------------|
| **Vercel agent-browser** | Rust CLI + Unix domain sockets + compact refs | 37% fewer tokens, 10-step flow: 7K vs 114K tokens | 3.5x faster |
| **Stagehand v3** | Direct CDP, element caching | Context builder feeds only essential data | 44% faster |
| **Browser-Use** | Raw CDP, no Playwright | Parallel connections, async events | Eliminates double hop |
| **Playwright CLI** | Saves snapshots to disk, not context | 2K-5K tokens per prompt vs 50K+ | ~$0.50 vs ~$45 per test |
| **WebClaw** | Compact tree format, interactive-only refs | 51-79% token reduction | Same speed, much cheaper |

### What We Should Build (or Adopt)

**Immediate (no architecture change):** Switch to interactive-only accessibility tree. Only return buttons, links, inputs, selects. Strip `[cursor=pointer]`, `/url:`, `[active]`. Expected: **50-80% token reduction**.

**Medium-term:** Replace MCP with **agent-browser** (Vercel). It gives:
- Batch commands (JSON array piping)
- Compact snapshots (~200-400 tokens vs 15K)
- Unix socket IPC (no HTTP overhead)
- Snapshot diff (Myers algorithm — only sends changes)

**Key insight:** Our Scout locator JSONs are a **pre-compiled element registry**. No other framework has this. We could skip the accessibility tree entirely for known elements and only use it for discovery/healing.

---

## FINDING 2: Visual Techniques Are Not Ready to Replace Accessibility Trees

### The Landscape

| Model | Type | Accuracy (ScreenSpot) | Accuracy (ScreenSpot-Pro) | Speed | Local? |
|-------|------|----------------------|--------------------------|-------|--------|
| **OmniParser V2** (Microsoft) | YOLOv8 + Florence-2 | Competitive | 39.6% (with GPT-4o) | 0.6-0.8s/frame | Yes (GPU) |
| **Aguvis** (Salesforce) | Pure vision VLM | 89.2% | N/A | LLM-speed | Yes (7B) |
| **GUI-Actor** (Microsoft) | Attention-based grounding | N/A | 44.6% (7B beats 72B) | LLM-speed | Yes (7B) |
| **UI-TARS** (ByteDance) | End-to-end GUI agent | SOTA on 10+ benchmarks | N/A | LLM-speed | Yes (7B/72B) |
| **UGround** (OSU NLP) | Universal grounding | 82.8% mobile, 80.4% web | N/A | LLM-speed | Yes (2B/7B/72B) |
| **SeeClick** (Nanjing U) | Screenshot-only grounding | 66.4% (Android) | N/A | LLM-speed | Yes |

### The Honest Assessment

**Standard UIs (ScreenSpot):** Vision models reach 80-89% accuracy. Good but not production-ready for testing (need 99%+).

**Professional/Complex UIs (ScreenSpot-Pro):** Best models only reach 44-55%. Enterprise apps (SAP, Salesforce, dense dashboards) are too complex for current vision.

**Set-of-Mark (SoM) prompting:** Tested by SeeAct — **underperforms textual grounding** on complex pages. GPT-4V "hallucinated" marker assignments. Not reliable for test automation.

### What IS Useful from Vision

**OmniParser V2 as a preprocessing pipeline:**
```
Screenshot → YOLOv8 (detect elements, ~5ms GPU)
           → OCR on each box (~50ms)
           → Florence-2 for icons (~100ms)
           → Output: structured element list
           → Total: ~150ms per frame, ZERO LLM tokens
```

**Hybrid approach (what UFO2 and Browser-Use do):**
- Accessibility tree as PRIMARY source (fast, accurate, semantic)
- OmniParser/vision as FALLBACK for gaps (custom-rendered controls, canvas, bad a11y)
- Best of both worlds

### Verdict for Our Framework

**Don't replace accessibility trees with vision. Augment them.** Use OmniParser V2 as a secondary detector for elements that Scout/a11y tree misses. But the primary execution path stays text-based — it's faster, cheaper, and more accurate.

---

## FINDING 3: Cached Execution Plans — The Missing Architecture

### The User's Key Insight Is Right

"If there is code, there is code fix, code maintenance." This is empirically validated:
- **55% of teams spend 20+ hours/week on test maintenance** (Rainforest QA 2024)
- Maintenance consumes up to **50% of the test automation budget** (World Quality Report)
- **Self-healing solves only 28% of failures** (selector breakage). The other 72% are timing, data, and logic issues.
- **60% of teams disable AI healing within 3 months** — performance overhead + false confidence

### Five Execution Models in the Industry

| Model | How It Works | Speed | Maintenance | Vendor Lock-in |
|-------|-------------|-------|-------------|---------------|
| **A: Generated Code** | LLM → Playwright specs | Fastest (290ms/action) | HIGH | None |
| **B: NLP Interpreted** (testRigor) | English → deterministic parser | Medium | None | HIGH |
| **C: Session Replay** (Meticulous) | Record user → replay + diff | Fast | None | HIGH |
| **D: Cached Execution Plans** | LLM → plan → cache → replay | Fast after 1st run | LOW (LLM heals) | LOW |
| **E: Record + ML Heal** (Reflect, mabl) | Record → multi-selector heal | Medium | Medium | HIGH |

### Cached Execution Plans: The Sweet Spot

**Academic validation (NeurIPS 2025):**
- "Agentic Plan Caching" paper: **50% cost reduction, 27% latency reduction, 96.6% accuracy**
- "AgentReuse" paper: **93% effective plan reuse rate, 93% latency reduction**

**How it works:**

```
FIRST RUN (slow, LLM-powered):
  Scenario.md → LLM Agent → Live Browser → Action Plan (JSON/YAML) → Cache

SUBSEQUENT RUNS (fast, no LLM):
  Cached Plan → Deterministic Executor → Browser (Playwright CDP) → Results

UI CHANGED (targeted healing):
  Failed Step → LLM gets page snapshot + failed step
             → LLM generates replacement step(s)
             → Updated plan cached for next run
```

**What a plan looks like:**
```json
{
  "scenario": "automationexercise-trial",
  "version": "1.0",
  "planHash": "a3f8c2...",
  "generatedAt": "2026-03-31",
  "steps": [
    {
      "step": 1,
      "type": "NAVIGATE",
      "action": "goto",
      "target": "https://automationexercise.com/"
    },
    {
      "step": 2,
      "type": "ACTION",
      "action": "click",
      "target": {"role": "link", "name": "Signup / Login"},
      "fallbacks": [
        {"text": "Signup / Login"},
        {"role": "link", "nameContains": "Signup"}
      ]
    },
    {
      "step": 3,
      "type": "ACTION",
      "action": "fill",
      "target": {"role": "textbox", "name": "Name"},
      "value": "{{testData.signupName}}"
    },
    {
      "step": 37,
      "type": "VERIFY",
      "assertion": "textVisible",
      "expected": "Blue Top",
      "context": "cart table"
    }
  ]
}
```

**This is NOT code.** It's a declarative, inspectable, version-controllable action plan. Key differences from generated code:

| Generated Code | Cached Execution Plan |
|----------------|----------------------|
| Imperative (HOW to do it) | Declarative (WHAT to do) |
| Coupled to framework API | Framework-agnostic |
| Selector-based targeting | Role + name + fallback targeting |
| Breaks on API changes | LLM re-generates broken steps |
| Needs developer to fix | Self-heals, human reviews |
| ~200 lines of TypeScript | ~77 JSON steps |

### Performance Projections

| Run Type | Time | LLM Cost |
|----------|------|----------|
| First run (plan generation) | ~60-120s | ~$0.10-0.50 |
| Cached replay | ~5-15s (Playwright CDP speed) | $0 |
| Healing run (1-3 steps) | ~10-30s | ~$0.01-0.05 |

**Cached replay at 5-15s is in Playwright spec territory** — because it IS Playwright, just driven by a plan instead of TypeScript.

### Industry Implementations

- **Skyvern** (YC-backed, open source): Building exactly this. "Explore → replay" pattern. 2.7x cheaper, 2.3x faster.
- **Healenium** (open source): Self-healing for Selenium using Longest Common Subsequence algorithm.
- **testRigor**: NLP interpreter is essentially a hardcoded plan executor (but proprietary).

---

## THE SYNTHESIS: What We Should Build

### Architecture: Cached Execution Plan Engine

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Scenario.md (natural language test steps)                       │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────────────────────────────────────────┐                │
│  │  PLAN GENERATOR (Explorer, one-time)          │                │
│  │  • Opens browser                              │                │
│  │  • Walks through each step                    │                │
│  │  • Records: what element, what action,        │                │
│  │    what assertion, what evidence               │                │
│  │  • Outputs: execution-plan.json               │                │
│  └──────────────────┬───────────────────────────┘                │
│                     │                                            │
│                     ▼                                            │
│  ┌──────────────────────────────────────────────┐                │
│  │  PLAN CACHE (version-controlled)              │                │
│  │  • execution-plan.json                        │                │
│  │  • Hash-based invalidation                    │                │
│  │  • Step-level granularity                     │                │
│  └──────────────────┬───────────────────────────┘                │
│                     │                                            │
│           ┌─────────┴─────────┐                                  │
│           ▼                   ▼                                  │
│  ┌─────────────────┐ ┌────────────────────┐                     │
│  │ REPLAY ENGINE    │ │ HEALER (on failure)│                     │
│  │ • Reads plan     │ │ • Gets page state  │                     │
│  │ • Drives browser │ │ • Gets failed step │                     │
│  │   via Playwright │ │ • LLM re-generates │                     │
│  │   CDP (no LLM)   │ │   just that step   │                     │
│  │ • 5-15s total    │ │ • Updates plan     │                     │
│  │ • $0 LLM cost    │ │ • $0.01-0.05/heal  │                     │
│  └─────────────────┘ └────────────────────┘                     │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────┐                │
│  │  TEST REPORT (PASS/FAIL per step)             │                │
│  │  • Same format as direct-executor-report      │                │
│  │  • CI/CD compatible                           │                │
│  └──────────────────────────────────────────────┘                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### What We Need to Build

1. **Plan Schema** — JSON format for execution plans (element targeting via role+name+fallbacks, not selectors)
2. **Plan Generator** — Modified Explorer that outputs a plan instead of enriched.md (Phase 1 already proved it can walk the flow perfectly)
3. **Replay Engine** — Deterministic Playwright executor that reads plans (no LLM, fast)
4. **Plan Healer** — On step failure, sends page snapshot + failed step to LLM for targeted repair
5. **Plan Cache** — File-based, version-controlled, hash-invalidated

### What We Already Have

- **Step classifier** — `scripts/step-classifier.js` (done)
- **Agent instructions** — `agents/core/direct-executor.md` (done, needs adaptation)
- **Report template** — `agents/report-templates/direct-executor-report.md` (done)
- **Proof that the flow works** — Phase 1 ran 77/77 steps at 100% accuracy
- **Scout locator JSONs** — Pre-computed element registry (our unique advantage)

---

## APPENDIX: Research Sources

### MCP Alternatives
- [Vercel agent-browser](https://github.com/vercel-labs/agent-browser) — 3.5x faster, 37% fewer tokens
- [Stagehand v3](https://github.com/browserbase/stagehand) — Direct CDP, 44% faster
- [Browser-Use](https://github.com/browser-use/browser-use) — Raw CDP, parallel connections
- [Playwright CLI](https://github.com/microsoft/playwright-mcp) — Snapshots to disk, $0.50 vs $45 per test
- [WebClaw](https://github.com/nicholasgriffintn/webclaw) — 51-79% token reduction
- [AgentFerrum](https://github.com/Alqemist-labs/agent_ferrum) — Dual markdown + a11y format

### Visual Grounding
- [OmniParser V2](https://github.com/microsoft/OmniParser) — YOLOv8 + Florence-2, 0.6s/frame
- [Aguvis](https://aguvis-project.github.io/) — 89.2% ScreenSpot, pure vision
- [GUI-Actor](https://microsoft.github.io/GUI-Actor/) — Coordinate-free grounding, NeurIPS 2025
- [UI-TARS](https://github.com/bytedance/UI-TARS) — End-to-end GUI agent, SOTA
- [UGround](https://github.com/OSU-NLP-Group/UGround) — ICLR 2025, 82.8% mobile
- [SeeAct](https://osu-nlp-group.github.io/SeeAct/) — ICML 2024, proved SoM underperforms text
- [ScreenSpot-Pro Leaderboard](https://gui-agent.github.io/grounding-leaderboard/)

### Cached Execution Plans
- [Agentic Plan Caching](https://arxiv.org/abs/2506.14852) — NeurIPS 2025: 50% cost reduction, 27% latency reduction
- [AgentReuse](https://arxiv.org/html/2512.21309) — 93% plan reuse, 93% latency reduction
- [Skyvern](https://github.com/Skyvern-AI/skyvern) — Explore → replay pattern
- [Healenium](https://github.com/healenium/healenium) — OSS self-healing, LCS algorithm
- [testRigor](https://testrigor.com/) — NLP interpreter, production-grade
- [Meticulous AI](https://www.meticulous.ai/) — Session replay, zero-authoring regression detection

### Industry Analysis
- [Self-Healing Tests: What Works, What Doesn't](https://qate.ai/blog/self-healing-tests) — 28% of failures are selectors, 60% disable healing in 3 months
- [Playwright MCP Burns 114K Tokens Per Test](https://scrolltest.medium.com/playwright-mcp-burns-114k-tokens-per-test)
- [Token War: CLI vs MCP](https://www.test-shift.com/posts/the-token-war-playwright-cli-vs-mcp)
