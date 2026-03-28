"""
conftest.py — Pytest configuration and fixtures for Agentic QE Framework v2.

This is the Python equivalent of playwright.config.ts.
"""

import os
import pytest
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    """Configure browser context for all tests."""
    return {
        **browser_context_args,
        "base_url": os.environ.get("BASE_URL"),
        "permissions": ["geolocation", "notifications"],
        "accept_downloads": True,
    }


@pytest.fixture(scope="session")
def browser_type_launch_args(browser_type_launch_args):
    """Configure browser launch arguments."""
    return {
        **browser_type_launch_args,
        "channel": "chrome",
        "headless": os.environ.get("HEADLESS", "true").lower() != "false",
        "args": [
            "--disable-features=PrivateNetworkAccessPermissionPrompt",
        ],
    }


@pytest.fixture(scope="session")
def viewport():
    """Set viewport size."""
    return {"width": 1920, "height": 1080}


# Action and navigation timeouts
ACTION_TIMEOUT = int(os.environ.get("DEFAULT_TIMEOUT", "30000"))
NAVIGATION_TIMEOUT = int(os.environ.get("NAVIGATION_TIMEOUT", "60000"))


@pytest.fixture(autouse=True)
def set_timeouts(page):
    """Set default timeouts for all tests."""
    page.set_default_timeout(ACTION_TIMEOUT)
    page.set_default_navigation_timeout(NAVIGATION_TIMEOUT)
