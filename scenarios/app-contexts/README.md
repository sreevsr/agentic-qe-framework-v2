# App-Contexts

Learned application patterns that persist across scenario runs. This is the self-improving skills mechanism (Voyager trajectory storage).

## How It Works

1. **First scenario for an app:** Explorer-Builder discovers patterns live, writes them to a new app-context file
2. **Subsequent scenarios:** Explorer-Builder reads the app-context FIRST, tries known patterns before blind exploration
3. **Self-improving:** Each run may add new patterns — next run starts with more knowledge

## File Naming Convention

`{app-identifier}.md` — derived from the application URL domain:

| URL | App-Context File |
|-----|-----------------|
| `https://epicview-qa.powerappsportals.com/Experts/` | `epicview-qa.md` |
| `https://www.saucedemo.com` | `saucedemo.md` |
| `https://petstore.swagger.io` | `petstore-swagger.md` |
| `com.example.myapp` (mobile) | `com-example-myapp.md` |

**Rule:** Use the primary domain/identifier, not the full URL. Strip `www.`, ports, and paths.

## What Goes In an App-Context

- Component interaction patterns discovered during exploration
- Known quirks (SSO redirect chains, slow-loading grids, custom dropdowns)
- Selector strategies that work for this app's UI framework
- Wait patterns needed for specific pages/components
- Authentication flow details
- Mobile-specific patterns (gesture needs, WebView context switching)

## What Does NOT Go In an App-Context

- Generic Playwright/Appium knowledge (standard HTML element interactions)
- Patterns that are obvious from the element type (e.g., "click a button")
- Test data or credentials (those go in .env and test-data/)
- Scenario-specific logic (that belongs in the scenario .md)

## Format: Reading (Explorer-Builder reads this)

```markdown
# App Context: [App Name]

## Application Details
- **URL:** https://app-url.com
- **UI Framework:** React / Angular / Power Apps / Native iOS / Native Android
- **Auth Method:** Microsoft SSO / Basic Login / OAuth / API Token

## Component Patterns

### Data Grids
- Framework: PCF / Kendo / AG Grid / etc.
- Sort icons: SVG elements (not IMG)
- Filter: Requires pressSequentially() instead of fill()
- Loading: Empty DOM → async inject → need waitForFunction()

### Dropdowns
- Type: Custom (Kendo/Fluent) — NOT native select
- Interaction: Click to open → wait for list → click option

## Navigation Patterns
- SSO redirect chain: /login → /callback → /home → /dashboard
- Final URL: /dashboard (wait for this, not intermediate URLs)

## Known Issues
- Grid takes 3-5 seconds to load after navigation
- Filter popover closes if you click outside

## Mobile Patterns (if applicable)
- Platform: Android (UiAutomator2) / iOS (XCUITest)
- Keyboard: Must hide after typing to access next element
- WebView: App has embedded WebView at [screen] — needs context switch
```

## Format: Writing (Explorer-Builder adds these after exploration)

```markdown
## Learned Pattern: [Component/Behavior Name]
- **Component:** [What kind of UI element]
- **Expected:** [What was tried first]
- **Actual:** [What actually worked]
- **Working approach:** [The successful strategy]
- **Discovered:** [Date]
```

**Example:**
```markdown
## Learned Pattern: PCF Grid Filter Icons
- **Component:** PCF Data Grid header filter/sort icons
- **Expected:** IMG elements for filter icons
- **Actual:** SVG elements rendered inline
- **Working approach:** Use `th:nth-child(N) svg:last-of-type` selector
- **Discovered:** 2026-03-27
```
