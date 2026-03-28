"""
Shared State — Persist values across scenarios via shared-state.json (Python).
Used by the SAVE keyword. Thread-safe with file locking.
"""

import json
import os
import time
from pathlib import Path

STATE_FILE = Path(__file__).parent.parent / "test-data" / "shared-state.json"
LOCK_FILE = Path(str(STATE_FILE) + ".lock")
LOCK_TIMEOUT = 5.0  # seconds
LOCK_RETRY = 0.05  # seconds


def _acquire_lock():
    """Acquire file lock for concurrent write safety."""
    start = time.time()
    while time.time() - start < LOCK_TIMEOUT:
        try:
            fd = os.open(str(LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
            return
        except FileExistsError:
            time.sleep(LOCK_RETRY)
    # Timeout — force break stale lock
    try:
        os.unlink(str(LOCK_FILE))
    except OSError:
        pass
    fd = os.open(str(LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.write(fd, str(os.getpid()).encode())
    os.close(fd)


def _release_lock():
    """Release file lock."""
    try:
        os.unlink(str(LOCK_FILE))
    except OSError:
        pass


def save_state(key: str, value) -> None:
    """Save a key-value pair to shared state (thread-safe)."""
    _acquire_lock()
    try:
        state = {}
        if STATE_FILE.exists():
            state = json.loads(STATE_FILE.read_text())
        state[key] = value
        STATE_FILE.write_text(json.dumps(state, indent=2))
    finally:
        _release_lock()


def load_state(key: str):
    """Load a value from shared state."""
    if not STATE_FILE.exists():
        return None
    state = json.loads(STATE_FILE.read_text())
    return state.get(key)


def load_all_state() -> dict:
    """Load entire shared state."""
    if not STATE_FILE.exists():
        return {}
    return json.loads(STATE_FILE.read_text())


def clear_state(key: str) -> None:
    """Clear a specific key (thread-safe)."""
    _acquire_lock()
    try:
        if not STATE_FILE.exists():
            return
        state = json.loads(STATE_FILE.read_text())
        state.pop(key, None)
        STATE_FILE.write_text(json.dumps(state, indent=2))
    finally:
        _release_lock()


def clear_all_state() -> None:
    """Clear all shared state (thread-safe)."""
    _acquire_lock()
    try:
        STATE_FILE.write_text(json.dumps({}, indent=2))
    finally:
        _release_lock()
