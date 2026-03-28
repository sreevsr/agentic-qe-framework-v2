"""
BasePage — Foundation for all page objects in the Agentic QE Framework v2 (Python).

Every generated page object extends this class. Provides:
- LocatorLoader integration for externalized selectors
- Common interaction methods with Playwright auto-waiting
- Screenshot and navigation utilities

UI framework-specific helpers are NOT here. The Explorer-Builder discovers
component patterns live. For reference patterns, see component-patterns.md.
"""

from playwright.sync_api import Page, Locator
from core.locator_loader import LocatorLoader


class BasePage:
    def __init__(self, page: Page, locator_file: str):
        self.page = page
        self.loc = LocatorLoader(page, locator_file)

    # Navigation
    def goto(self, url: str):
        self.page.goto(url, wait_until="networkidle")

    def wait_for_page_load(self, state: str = "networkidle"):
        self.page.wait_for_load_state(state)

    def get_current_url(self) -> str:
        return self.page.url

    # Element Interactions
    def click(self, element_name: str):
        self.page.locator(self.loc.get(element_name)).click()

    def fill(self, element_name: str, value: str):
        self.page.locator(self.loc.get(element_name)).fill(value)

    def press_sequentially(self, element_name: str, value: str, delay: int = 0):
        """Type text character by character. Use for autocomplete/search inputs."""
        self.page.locator(self.loc.get(element_name)).press_sequentially(value, delay=delay)

    def select_option(self, element_name: str, value: str):
        self.page.locator(self.loc.get(element_name)).select_option(value)

    def check(self, element_name: str):
        self.page.locator(self.loc.get(element_name)).check()

    def uncheck(self, element_name: str):
        self.page.locator(self.loc.get(element_name)).uncheck()

    def hover(self, element_name: str):
        self.page.locator(self.loc.get(element_name)).hover()

    def clear(self, element_name: str):
        self.page.locator(self.loc.get(element_name)).clear()

    # Element Queries
    def get_text(self, element_name: str) -> str:
        return self.page.locator(self.loc.get(element_name)).text_content() or ""

    def get_inner_text(self, element_name: str) -> str:
        return self.page.locator(self.loc.get(element_name)).inner_text()

    def get_input_value(self, element_name: str) -> str:
        return self.page.locator(self.loc.get(element_name)).input_value()

    def get_attribute(self, element_name: str, attr: str) -> str | None:
        return self.page.locator(self.loc.get(element_name)).get_attribute(attr)

    def is_visible(self, element_name: str) -> bool:
        return self.page.locator(self.loc.get(element_name)).is_visible()

    def is_enabled(self, element_name: str) -> bool:
        return self.page.locator(self.loc.get(element_name)).is_enabled()

    def is_checked(self, element_name: str) -> bool:
        return self.page.locator(self.loc.get(element_name)).is_checked()

    def get_count(self, element_name: str) -> int:
        return self.page.locator(self.loc.get(element_name)).count()

    # Wait Utilities
    def wait_for_element(self, element_name: str, state: str = "visible", timeout: int | None = None):
        self.page.wait_for_selector(self.loc.get(element_name), state=state, timeout=timeout)

    def wait_for_url(self, url_pattern: str, timeout: int | None = None):
        self.page.wait_for_url(url_pattern, timeout=timeout)

    # Locator Access
    def get_locator(self, element_name: str) -> Locator:
        return self.loc.get_locator(element_name)

    # Screenshots
    def take_screenshot(self, name: str) -> bytes:
        return self.page.screenshot(full_page=True)
