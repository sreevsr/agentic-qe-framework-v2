# Skill: a11y/axe-audit

## Input
- **scope** ('full-page' | 'component', required): Audit entire page or specific component
- **selector** (string, optional): Component selector when scope='component'
- **standard** ('wcag2a' | 'wcag2aa' | 'wcag21aa' | 'best-practice', default: 'wcag2aa')

## Output
- **violations** (array): Accessibility violations found
- **passes** (number): Rules that passed
- **incomplete** (number): Rules that need manual review

## Rules — MUST Follow
- **MUST** install `@axe-core/playwright` as devDependency
- **MUST** run audit AFTER page is fully loaded and interactive
- **MUST** report violations with impact level (critical, serious, moderate, minor)
- **MUST NOT** ignore critical or serious violations — these are WCAG failures

## Code Patterns
```typescript
import AxeBuilder from '@axe-core/playwright';

// Full page audit
const results = await new AxeBuilder({ page })
  .withTags(['wcag2aa'])
  .analyze();
expect(results.violations).toEqual([]);

// Component-specific audit
const results = await new AxeBuilder({ page })
  .include('#main-navigation')
  .withTags(['wcag2aa'])
  .analyze();

// Exclude known third-party widgets
const results = await new AxeBuilder({ page })
  .exclude('#chat-widget')
  .exclude('#analytics-banner')
  .analyze();

// Attach violations report to test
if (results.violations.length > 0) {
  await test.info().attach('a11y-violations', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });
}
```

## Known Patterns
- **Enterprise apps with legacy components:** May have many violations — prioritize critical/serious
- **Dynamic content:** Audit after all AJAX calls complete, not on initial load
- **Third-party widgets:** Exclude chat widgets, analytics, ads from audit scope
