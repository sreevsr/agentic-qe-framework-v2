# App-Contexts

Learned application patterns that persist across scenario runs.

## How It Works

1. **First scenario:** Explorer-Builder discovers patterns live, writes to app-context file
2. **Subsequent scenarios:** Explorer-Builder reads app-context FIRST, tries known patterns
3. **Self-improving:** Each run may add new patterns (Voyager trajectory storage)

## File Naming

`{app-identifier}.md` — e.g., `epicview-qa.md`, `saucedemo.md`

## Example Structure

```markdown
# App Context: [App Name]

## Application Details
- **URL:** https://app-url.com
- **UI Framework:** React / Angular / Power Apps
- **Auth Method:** Microsoft SSO / Basic Login

## Component Patterns
### Data Grids
- Sort icons: SVG elements (not IMG)
- Filter: Requires pressSequentially() instead of fill()

### Dropdowns
- Type: Custom (Kendo) — click to open → wait → click option

## Navigation Patterns
- SSO redirect: /login → /callback → /dashboard

## Known Issues
- Grid takes 3-5s to load after navigation
```
