# Visual & CV Approaches for UI Test Automation — Research (2025-2026)

**Date:** 2026-03-31
**Purpose:** Architecture decision input for Agentic QE Framework v2
**Scope:** Production-viable computer vision and visual approaches for "find this UI element reliably"

---

## Executive Summary

The landscape has shifted significantly in 2025-2026. Three tiers of solutions exist:

| Tier | Approach | Speed | Cost | Reliability |
|------|----------|-------|------|-------------|
| **Tier 1: Production-proven** | DOM selectors + self-healing (Healenium) | <10ms | Free | High for stable apps |
| **Tier 2: Emerging-viable** | OmniParser + SoM, Skyvern hybrid | 1-5s per screen | Low-Medium | Medium-High |
| **Tier 3: Expensive but powerful** | Claude Computer Use, GPT-4V coordinate | 3-15s per action | High ($$$) | Medium, improving fast |

**Bottom line:** No single visual approach replaces DOM selectors for speed and reliability. The winning architecture is **hybrid: DOM-first, visual-fallback**, with CV used for element discovery/healing rather than runtime execution.

---

## 1. OmniParser (Microsoft)

**What it is:** A screen parsing tool that converts UI screenshots into structured, labeled elements. Uses YOLO-based icon detection + Florence-based icon captioning.

**GitHub:** microsoft/OmniParser — 24.6k stars (very active, March 2026)

### How it works
1. Screenshot input
2. YOLO model detects interactive UI regions (buttons, inputs, icons)
3. Florence model captions each detected element with functional descriptions
4. Output: bounding boxes with numeric IDs + text/icon descriptions

### What it outputs
- Bounding boxes for every interactive element
- Numeric IDs overlaid on screenshot (for SoM-style prompting)
- Text extracted via OCR
- Icon functional descriptions ("search button", "close icon")
- Interactability predictions

### Speed
- **Not fast.** No official latency numbers published.
- Community reports: **2-5 seconds** per screenshot on GPU (YOLO inference + Florence captioning).
- CPU-only: expect 5-15 seconds per screenshot.
- This is a **batch/preprocessing tool**, not a real-time element finder.

### Local vs Cloud
- **Runs locally.** Conda environment, Python 3.12, requires GPU for reasonable speed.
- Models downloadable from HuggingFace.
- No cloud dependency.

### Production-ready?
- **Partially.** Top scores on ScreenSpot Pro benchmark (39.5%) and Windows Agent Arena.
- V2 is latest. Active development (154 commits).
- YOLO component is AGPL licensed (restrictive for commercial use).
- Best used as a **preprocessing/discovery step**, not runtime element finding.

### Honest limitations
- Slow for real-time automation (2-5s per screen parse)
- AGPL license on YOLO component is a commercial concern
- 39.5% on ScreenSpot Pro means it misses 60% of elements in complex UIs
- Struggles with enterprise apps (dense forms, custom widgets, overlapping elements)
- No built-in element re-identification across page transitions

### Verdict for our framework
**Strong candidate for Scout-phase element discovery.** Parse a screenshot, get all interactive elements with bounding boxes, use that to bootstrap locator JSONs. NOT suitable for runtime test execution.

---

## 2. Set-of-Mark (SoM) Prompting

**What it is:** A visual prompting technique that overlays numbered marks on UI screenshots, enabling vision LLMs to reference specific elements by number.

**GitHub:** microsoft/SoM

### How it works
1. Take a screenshot of the UI
2. Run segmentation (SAM, Mask DINO, SEEM) to detect regions
3. Overlay numbered/colored marks on each detected region
4. Send marked screenshot to a vision LLM (GPT-4V, Claude, etc.)
5. LLM can now say "click element 7" instead of guessing coordinates

### Who uses it
- OmniParser V2 uses SoM-style numbered overlays
- Skyvern internally uses similar approach
- Multiple research agents (WebVoyager, SeeAct, etc.)
- Roboflow community implementations

### Speed
- Segmentation: 0.5-2s (depends on model)
- LLM inference with marked image: 2-10s
- Total per action: **3-12 seconds**

### Production-ready?
- The concept is proven and widely adopted in agent research.
- Production implementations exist (OmniParser, Skyvern).
- But it requires a vision LLM call per action, making it expensive at scale.

### Honest limitations
- Requires vision LLM call for every interaction decision
- Mark overlap in dense UIs (enterprise forms with 50+ fields)
- Segmentation quality varies — custom widgets often missed
- High latency per action (3-12s)
- Token cost per marked screenshot: ~1000-2000 tokens

### Verdict for our framework
**Useful for Explorer-phase flow verification**, not for generated test runtime. Could augment Scout by showing a numbered screenshot to the LLM to verify which elements are interactive.

---

## 3. Coordinate-Based Browser Automation

### 3a. Anthropic Computer Use / Claude Computer Use

**What it is:** Claude models can see screenshots and output x,y coordinates to click, type, scroll. It is a full computer control API.

**Status:** Beta (still as of March 2026), but actively developed across Claude Opus 4.6, Sonnet 4.6, Opus 4.5, Sonnet 4.5, Haiku 4.5.

#### How it works
1. You provide a `computer` tool definition with display dimensions
2. Claude takes a screenshot
3. Claude analyzes the screenshot visually
4. Claude outputs actions: `left_click` at `[x, y]`, `type` text, `key` combo, `scroll`, etc.
5. Your code executes the action in the environment
6. Loop: screenshot -> analyze -> act -> screenshot

#### Recommended resolution
- **1024x768** (XGA) for best accuracy
- Higher resolutions get downscaled, losing accuracy
- Coordinates are in the scaled image space; you must map back to actual screen

#### Token costs
- System prompt overhead: 466-499 tokens
- Computer use tool definition: 735 tokens per tool
- Each screenshot: ~1000-2000 tokens (varies by resolution, as vision input)
- Per action cycle (screenshot + reasoning + action): roughly **2000-4000 tokens**
- At Sonnet pricing (~$3/M input, $15/M output): **~$0.01-0.05 per action**
- A 20-step test: **$0.20-1.00 per run**

#### Speed
- **3-15 seconds per action** (screenshot capture + API call + model reasoning)
- A 20-step test: **1-5 minutes**
- Documentation explicitly says: "latency may be too slow for human-AI interactions"

#### Production-ready?
- **Beta.** Anthropic says to "focus on use cases where speed isn't critical (background information gathering, automated software testing) in trusted environments."
- Needs sandboxed VM/container (security requirement)
- Prompt injection risk from on-screen content

#### Honest limitations
- **Slow:** 3-15s per action, unusable for fast test suites
- **Expensive:** $0.20-1.00 per 20-step test run
- **Coordinate accuracy:** Can miss targets, especially small elements or dense UIs
- **No element identity:** Pure visual — cannot distinguish two identical-looking buttons
- **Scrolling reliability:** Improved but still noted as a limitation
- **Spreadsheet interaction:** Acknowledged as problematic
- **Prompt injection:** On-screen text can override instructions

### 3b. Skyvern

**What it is:** Open-source browser automation framework using LLMs + computer vision. 21k stars on GitHub.

#### How it works
- Hybrid approach: Playwright browser + AI-augmented actions
- Uses vision LLMs to understand pages it has never seen before
- Natural language element targeting: `await page.click(prompt="Click the login button")`
- Three modes: traditional selectors, pure AI, hybrid fallback

#### Speed & accuracy
- WebBench benchmark: **64.4% accuracy**
- Latency: seconds per action (LLM call required)

#### Production-ready?
- Available as Skyvern Cloud (managed) and open-source (pip install)
- Used in production for web scraping and form filling
- Not suitable for fast, deterministic test execution

### 3c. OpenAdapt

**What it is:** Open-source adapter between LMMs and desktop/web GUIs. 1.5k stars. Records demonstrations and deploys automation agents.

#### How it works
- Records user demonstrations (screenshots + actions)
- Uses VLMs (Claude, GPT-4o, Qwen3-VL) to understand GUI context
- Separates "Policy" (what to do) from "Grounding" (where to click — maps intent to coordinates)
- Can work zero-shot or from demonstrations

#### Production-ready?
- Phase 2 (retrieval prompting) validated, Phase 3 (fine-tuning) in progress
- 100% first-action accuracy on controlled macOS tasks
- Still evolving, not enterprise-ready

### Verdict on coordinate-based approaches
**Too slow and expensive for test execution.** Best suited for:
- One-time exploration/discovery (our Explorer phase)
- Fallback when DOM selectors fail
- Verifying visual correctness (does the UI look right?)

---

## 4. Local OCR for UI Automation

### Tesseract
- **Speed:** ~100-500ms per image (CPU), depends on image size
- **Accuracy:** ~85-95% on clean text, drops significantly on anti-aliased UI text, small fonts, colored backgrounds
- **UI text verdict:** Mediocre. Designed for document OCR, not UI rendering.
- **Production-ready:** Yes (v5.x), but needs preprocessing for UI screenshots

### EasyOCR
- **Speed:** ~200-1000ms per image (GPU), 1-5s (CPU)
- **Accuracy:** Generally better than Tesseract on scene text. 80+ languages.
- **UI text verdict:** Decent for button text, labels, headings. Struggles with small/light text.
- **Production-ready:** Yes (v1.7.2, Sep 2024). 474 open issues.
- **License:** Apache 2.0

### PaddleOCR
- **Speed:** Fastest of the three. GPU-optimized, supports multi-process parallel inference.
- **Accuracy:** PP-OCRv5 claims 13% improvement over predecessors. 100+ languages.
- **Benchmark:** 94.5% on OmniDocBench (document-focused)
- **UI text verdict:** Best option for UI text extraction. Supports ONNX for optimized deployment.
- **Production-ready:** Yes. 70k+ stars. Commercial-grade.
- **License:** Apache 2.0

### Comparison

| Feature | Tesseract | EasyOCR | PaddleOCR |
|---------|-----------|---------|-----------|
| Speed (GPU) | N/A (CPU only) | 200-1000ms | Fastest |
| Speed (CPU) | 100-500ms | 1-5s | 200-800ms |
| UI text accuracy | ~85% | ~90% | ~93%+ |
| Languages | 100+ | 80+ | 100+ |
| License | Apache 2.0 | Apache 2.0 | Apache 2.0 |
| Best for | Document OCR | Scene text | UI/document text |

### Verdict for our framework
**PaddleOCR is the clear winner for UI text extraction.** Use case: extract visible text from screenshots to verify element labels, validate page content, or as fallback text matching when DOM text extraction fails.

---

## 5. YOLO Models for UI Element Detection

### Pre-trained models for UI
- **OmniParser's YOLO model:** Trained specifically on UI elements (buttons, inputs, icons, checkboxes). Best available pre-trained option.
- **HuggingFace models:** Several community models exist (e.g., `yolos-small-ui-element-detection`) but accuracy/quality varies.
- **No official Ultralytics UI model.** You would need to fine-tune on UI datasets.

### Speed (Ultralytics YOLO26)

| Model | CPU (ONNX) | GPU (T4 TensorRT) |
|-------|-----------|-------------------|
| YOLO26n (nano) | 39ms | 1.7ms |
| YOLO26s (small) | ~80ms | ~3ms |
| YOLO26m (medium) | ~180ms | ~6ms |
| YOLO26x (xlarge) | 526ms | 12ms |

### What you could detect
With fine-tuning on UI datasets:
- Buttons, inputs, checkboxes, radio buttons, dropdowns
- Icons, images, links
- Navigation elements, menus
- Modal dialogs, tooltips

### Honest limitations
- **Requires training data.** No great off-the-shelf UI detector (OmniParser's is closest).
- **Context-blind.** YOLO finds "a button" but doesn't know it's the "Submit" button vs "Cancel".
- **Enterprise UIs are hard.** Custom React/MUI components don't look like standard HTML.
- **Needs OCR companion.** YOLO finds the box, OCR reads the text inside.

### Verdict for our framework
**YOLO + OCR is a viable local, fast pipeline for element discovery.** Could replace OmniParser's YOLO component with a custom-trained model on our target app's UI patterns. Speed is excellent (<50ms GPU). But the training data investment is significant.

---

## 6. Template Matching (OpenCV)

### How it works
- Take a reference image of a UI element (e.g., a button)
- Use OpenCV `matchTemplate()` to find it in a screenshot
- Returns bounding box of best match

### Speed
- **Extremely fast:** 1-10ms per match on a 1080p screenshot
- No GPU needed

### Who uses it for automation?
- **SikuliX:** The original image-based automation tool. Uses OpenCV template matching.
- **Appium Image Plugin:** Supports `findElementByImage()` using OpenCV.
- **Some game testing frameworks** use template matching heavily.
- **Robot Framework ImageHorizonLibrary:** Template matching for desktop automation.

### Honest limitations
- **Brittle to scale changes.** A button at 100% zoom won't match at 110% zoom.
- **Brittle to theme changes.** Dark mode vs light mode breaks all templates.
- **Brittle to text changes.** "Submit" vs "Soumettre" (i18n) breaks templates.
- **Requires reference image maintenance.** Every UI change = new reference images.
- **Cannot handle dynamic content.** User names, dates, counts all change.
- **Multi-resolution pain.** Different screen DPIs break matches.

### Verdict for our framework
**Not recommended as primary approach.** Template matching is fast but too fragile for web apps where themes, text, and layouts change. Could be used as a **last-resort fallback** for truly static elements (logos, icons that never change).

---

## 7. Browser-Native Visual Approaches

### Playwright
- **No visual element targeting.** Playwright locators are purely DOM-based (role, text, testId, CSS, XPath).
- **Visual comparison exists** but only for assertions (`toHaveScreenshot()`), not element finding.
- **Aria snapshots** capture accessibility tree, not visual appearance.
- **No image-based locators.** Unlike Appium, Playwright has no `findByImage()`.

### Cypress
- Same as Playwright — DOM-only locators. Visual testing via plugins (Percy, Applitools).

### Appium
- **Has image-based locators** via `findElementByImage()` using OpenCV.
- **Mobile-focused.** Works for native mobile apps where DOM is limited.
- Speed: 200-500ms per image match.

### WebDriver BiDi
- New standard (2025). No visual features — focused on DOM and network.

### Verdict
**Browsers don't do visual element targeting.** This is a deliberate design choice — DOM selectors are faster and more reliable. Any visual approach must be built on top, not inside the browser.

---

## 8. Hybrid Approaches (DOM + Visual)

### Healenium (Open Source, Self-Healing Selenium)
- **What:** Java library that intercepts failed Selenium `findElement()` calls and heals them.
- **How:** Stores DOM tree snapshots. When a selector breaks, compares current DOM to stored snapshot using tree-matching algorithm. Proposes alternative selectors ranked by match probability.
- **Visual?** No — purely DOM tree comparison. No computer vision.
- **Production:** Yes. 198 stars, 401 dependents, v3.5.8. Stable.
- **Limitation:** Java/Selenium only. Not for Playwright. DOM-only healing.

### Mabl (Commercial)
- **What:** SaaS test automation platform with auto-healing.
- **How:** Combines multiple selector strategies + ML for element identification.
- **Visual?** Uses visual validation (screenshot comparison) but element targeting is DOM-based.
- **Production:** Yes. Enterprise customers.
- **Limitation:** Closed source, SaaS-only, vendor lock-in. Pricing: $$$.

### Testim (Commercial, acquired by Tricentis)
- **What:** AI-powered test automation with Smart Locators.
- **How:** Generates multiple selectors per element, uses ML to pick the most resilient one. Falls back through strategies.
- **Visual?** Uses "visual validation" for assertions but targeting is DOM-based with ML ranking.
- **Production:** Yes. Enterprise.
- **Limitation:** Commercial, SaaS, vendor lock-in.

### AskUI (Open Source + Commercial)
- **What:** Automation SDK that targets elements by what's visible on screen.
- **How:** "Reliable, automated end-to-end-automation that only depends on what is shown on your screen."
- **Visual?** Yes — computer vision-based. Elements targeted by visual appearance, not DOM.
- **Production:** 71 releases (v0.31.0, Dec 2025). MIT licensed. Active development.
- **Limitation:** Slower than DOM selectors (CV inference per action). Limited documentation on internals.
- **Unique:** Cross-platform (desktop, web, mobile) because it's purely visual.

### Skyvern (Open Source)
- Already covered in Section 3b. Hybrid: Playwright + AI visual fallback.

### Verdict for our framework
**The winning pattern is clear: DOM-first, visual-fallback.** No commercial or open-source tool has replaced DOM selectors as the primary targeting mechanism. The best tools (Healenium, Mabl, Testim) all use DOM as primary and ML/visual as healing/fallback. AskUI is the only pure-visual tool, and it trades speed for cross-platform flexibility.

---

## 9. Anthropic Computer Use — Deep Dive

(Detailed in Section 3a above. Key additional findings:)

### Cost model for test automation

| Scenario | Actions | Token cost | Dollar cost (Sonnet) |
|----------|---------|------------|---------------------|
| Simple login test | 5 | ~15k tokens | ~$0.05-0.10 |
| E-commerce checkout | 20 | ~60k tokens | ~$0.20-1.00 |
| Full regression suite (50 tests x 20 steps) | 1000 | ~3M tokens | ~$10-50 per run |
| Daily CI (3 runs) | 3000 | ~9M tokens | ~$30-150/day |

### When it makes sense
- **Exploratory testing** where you describe what to test in natural language
- **One-time element discovery** (find all interactive elements on this page)
- **Visual verification** (does this page look correct?)
- **Cross-platform testing** where you can't access DOM (desktop apps, Citrix)

### When it does NOT make sense
- **Regression suites** — too slow, too expensive, non-deterministic
- **CI/CD pipelines** — 1-5 min per test is unacceptable
- **High-frequency execution** — cost scales linearly with runs

---

## 10. New Tools (2025-2026) Solving Element Finding

### OmniParser V2 (Microsoft, 2025)
Already covered. The most significant new tool for UI element parsing.

### Claude Computer Use with Zoom (Late 2025 / Opus 4.6)
- New `zoom` action lets Claude inspect a specific screen region at full resolution
- Addresses the "small element" accuracy problem
- Still coordinate-based, still slow

### Skyvern SDK (2025)
- Natural language locators: `page.click(prompt="Click login")`
- Hybrid fallback: tries DOM first, falls back to AI
- 64.4% WebBench accuracy — promising but not production-reliable alone

### Browser Use (Open Source, 2025)
- Another LLM-based browser automation framework
- Uses accessibility tree + screenshots for element targeting
- Popular in the agent community, not widely used for testing

### Qwen-VL / InternVL (Open Source VLMs, 2025-2026)
- Open-source vision-language models that can understand UIs
- Run locally, no API costs
- Qwen3-VL used by OpenAdapt for grounding
- Smaller, faster, cheaper than GPT-4V or Claude — but less accurate

### UI-TARS (ByteDance, 2025)
- Vision-language model specifically trained for UI understanding
- Can identify elements, describe them, predict interactions
- Open-source on HuggingFace
- Designed for phone/web UI, not enterprise apps

### Ferret-UI (Apple, 2025)
- Multimodal LLM for mobile UI understanding
- Can refer to and ground UI elements
- Research-stage, not a deployable tool

---

## Architecture Recommendation for Agentic QE Framework

Based on this research, here is the recommended hybrid architecture:

### Layer 1: Primary (Fast, Deterministic)
```
DOM Selectors via Playwright (role, testId, text, CSS)
Source: Scout-captured locator JSONs
Speed: <10ms per find
Cost: Zero
```

### Layer 2: Self-Healing (When selectors break)
```
DOM Tree Comparison (Healenium-style)
When: Primary selector fails
How: Compare current DOM tree to stored snapshot, find closest match
Speed: 50-200ms
Cost: Zero (local computation)
```

### Layer 3: Visual Fallback (When DOM healing fails)
```
OmniParser / YOLO + PaddleOCR
When: DOM healing fails or element not in DOM (canvas, SVG, custom paint)
How: Screenshot -> detect elements -> OCR text -> match by text/position
Speed: 1-5s
Cost: Zero (local GPU) or low (small model inference)
```

### Layer 4: AI Grounding (Last resort / Discovery)
```
Vision LLM (Claude/GPT-4V) with SoM
When: All else fails, or during Scout/Explorer discovery
How: Marked screenshot -> LLM identifies element -> coordinates
Speed: 3-15s
Cost: $0.01-0.05 per action
```

### What NOT to build
- Do NOT make Claude Computer Use the primary execution engine (too slow, too expensive)
- Do NOT use template matching for web apps (too brittle)
- Do NOT train custom YOLO models unless you have 5000+ labeled UI screenshots
- Do NOT rely on pure coordinate-based automation for regression tests

### Practical next steps
1. **Keep DOM selectors as primary** — they work, they're fast, they're free
2. **Add PaddleOCR** for text extraction from screenshots (useful for verification)
3. **Integrate OmniParser** into Scout phase for automated element discovery
4. **Build DOM-diff self-healing** (Healenium-style) for selector resilience
5. **Use Claude Computer Use** only in Explorer phase for flow verification, not in generated tests

---

## Appendix: Speed Comparison (per element find)

| Approach | Latency | GPU Required? | Cost per Find |
|----------|---------|--------------|---------------|
| Playwright DOM selector | <10ms | No | Free |
| DOM tree comparison (healing) | 50-200ms | No | Free |
| OpenCV template match | 1-10ms | No | Free |
| YOLO26 UI detection (full screen) | 2-40ms | Yes (fast) / 40-500ms CPU | Free |
| PaddleOCR text extraction | 50-200ms | Optional | Free |
| OmniParser full pipeline | 2-5s | Yes | Free |
| EasyOCR | 200-1000ms | Optional | Free |
| Skyvern AI locator | 2-8s | No (API) | $0.01-0.05 |
| Claude Computer Use | 3-15s | No (API) | $0.01-0.05 |
| GPT-4V with SoM | 3-15s | No (API) | $0.01-0.05 |

---

## Appendix: License Summary

| Tool | License | Commercial Use? |
|------|---------|----------------|
| OmniParser (YOLO part) | AGPL | Requires open-sourcing your code |
| OmniParser (Florence part) | MIT | Yes |
| PaddleOCR | Apache 2.0 | Yes |
| EasyOCR | Apache 2.0 | Yes |
| Tesseract | Apache 2.0 | Yes |
| Ultralytics YOLO | AGPL | Requires enterprise license |
| Healenium | Apache 2.0 | Yes |
| Skyvern | AGPL | Requires enterprise license |
| AskUI | MIT | Yes |
| OpenAdapt | MIT | Yes |
| Playwright | Apache 2.0 | Yes |
