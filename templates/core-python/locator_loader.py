"""
LocatorLoader — Loads selectors from JSON locator files (Python).

Supports semantic selector prefixes resolved to Playwright-compatible format:
- role=button[name='Submit']  → page.get_by_role('button', name='Submit')
- label=Email                 → page.get_by_label('Email')
- placeholder=Enter email     → page.get_by_placeholder('Enter email')
- text=Welcome                → page.get_by_text('Welcome')
- testid=submit-btn           → page.get_by_test_id('submit-btn')
- xpath=//div[@id='main']     → page.locator('xpath=//div[@id="main"]')
- (no prefix)                 → CSS selector (default)
"""

import json
from pathlib import Path
from playwright.sync_api import Page, Locator


class LocatorLoader:
    def __init__(self, page: Page, locator_file: str):
        self.page = page
        file_path = Path(__file__).parent.parent / "locators" / locator_file
        if not file_path.exists():
            raise FileNotFoundError(f"Locator file not found: {file_path}")
        with open(file_path, "r") as f:
            self._locators = json.load(f)

    def get(self, element_name: str) -> str:
        """Get the primary selector string, resolving semantic prefixes to CSS equivalents."""
        entry = self._locators.get(element_name)
        if not entry:
            raise KeyError(f"Element '{element_name}' not found in locator file")
        raw = entry if isinstance(entry, str) else entry["primary"]
        return self._resolve_to_css(raw)

    def get_locator(self, element_name: str) -> Locator:
        """Get a Playwright Locator using the appropriate method based on prefix."""
        entry = self._locators.get(element_name)
        if not entry:
            raise KeyError(f"Element '{element_name}' not found in locator file")
        raw = entry if isinstance(entry, str) else entry["primary"]
        return self._resolve(raw)

    def get_with_fallback(self, element_name: str) -> str:
        """Try primary, then fallbacks. Returns first selector that finds an element."""
        entry = self._locators.get(element_name)
        if not entry:
            raise KeyError(f"Element '{element_name}' not found in locator file")

        primary = entry if isinstance(entry, str) else entry["primary"]
        fallbacks = [] if isinstance(entry, str) else entry.get("fallbacks", [])

        for selector in [primary, *fallbacks]:
            try:
                locator = self._resolve(selector)
                locator.wait_for(state="attached", timeout=2000)
                return self._resolve_to_css(selector)
            except Exception:
                continue

        return self._resolve_to_css(primary)

    def get_all(self, element_name: str) -> list[str]:
        """Get all selectors (primary + fallbacks) for an element."""
        entry = self._locators.get(element_name)
        if not entry:
            return []
        if isinstance(entry, str):
            return [entry]
        return [entry["primary"]] + entry.get("fallbacks", [])

    def has(self, element_name: str) -> bool:
        """Check if element exists in locator file."""
        return element_name in self._locators

    def _resolve(self, selector: str) -> Locator:
        """Resolve a selector string to a Playwright Locator."""
        if selector.startswith("role="):
            import re
            match = re.match(r"^role=(\w+)(?:\[name='(.+)'\])?$", selector)
            if match:
                role = match.group(1)
                name = match.group(2)
                return self.page.get_by_role(role, name=name) if name else self.page.get_by_role(role)

        if selector.startswith("label="):
            return self.page.get_by_label(selector[6:])

        if selector.startswith("placeholder="):
            return self.page.get_by_placeholder(selector[12:])

        if selector.startswith("text="):
            return self.page.get_by_text(selector[5:])

        if selector.startswith("testid="):
            return self.page.get_by_test_id(selector[7:])

        return self.page.locator(selector)

    def _resolve_to_css(self, selector: str) -> str:
        """Convert semantic prefix to CSS-compatible string for page.locator()."""
        if selector.startswith("testid="):
            return f"[data-testid='{selector[7:]}']"
        # role=, text=, label=, placeholder= are handled natively by Playwright's locator()
        return selector
