/**
 * Scout Toolbar — Injected into the browser page for in-page scan control.
 * Replaces Terminal 2 / remote-control.js from v1.
 *
 * Features:
 * - Draggable floating toolbar (grab the ≡ handle)
 * - Scan: instant two-pass DOM capture
 * - Timed 5s: countdown then scan (for tooltips, hover elements)
 * - Done: finalize and close
 * - Page name prompt before each scan
 * - Live counter for pages and elements
 */

function injectScoutToolbar() {
  // Prevent double-injection
  if (document.getElementById('scout-toolbar-root')) return;

  const root = document.createElement('div');
  root.id = 'scout-toolbar-root';
  root.innerHTML = `
    <style>
      #scout-toolbar {
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 2147483647;
        background: #1a1a2e;
        color: #e0e0e0;
        padding: 0;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        min-width: 280px;
        user-select: none;
        cursor: default;
        border: 1px solid #2d2d4a;
      }
      #scout-toolbar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: #16213e;
        border-radius: 10px 10px 0 0;
        cursor: grab;
        border-bottom: 1px solid #2d2d4a;
      }
      #scout-toolbar-header:active {
        cursor: grabbing;
      }
      #scout-toolbar-header .grip {
        font-size: 16px;
        margin-right: 8px;
        opacity: 0.6;
      }
      #scout-toolbar-header .title {
        font-weight: 600;
        font-size: 13px;
        flex-grow: 1;
      }
      #scout-toolbar-body {
        padding: 12px;
      }
      #scout-toolbar-buttons {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
      }
      #scout-toolbar button {
        padding: 6px 14px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        font-family: inherit;
        transition: background 0.15s, transform 0.1s;
      }
      #scout-toolbar button:active {
        transform: scale(0.96);
      }
      #scout-btn-scan {
        background: #0f3460;
        color: #e0e0e0;
      }
      #scout-btn-scan:hover {
        background: #1a4a7a;
      }
      #scout-btn-timed {
        background: #533483;
        color: #e0e0e0;
      }
      #scout-btn-timed:hover {
        background: #6b44a0;
      }
      #scout-btn-timed.counting {
        background: #e94560;
        color: white;
      }
      #scout-btn-done {
        background: #1b6b3a;
        color: #e0e0e0;
      }
      #scout-btn-done:hover {
        background: #238a4a;
      }
      #scout-toolbar-status {
        font-size: 12px;
        opacity: 0.7;
        display: flex;
        justify-content: space-between;
      }
      #scout-toolbar-message {
        font-size: 11px;
        margin-top: 6px;
        padding: 4px 8px;
        background: #16213e;
        border-radius: 4px;
        display: none;
        color: #a0d0ff;
      }
      #scout-name-input-wrapper {
        display: none;
        margin-bottom: 8px;
      }
      #scout-name-input {
        width: 100%;
        padding: 6px 8px;
        border: 1px solid #2d2d4a;
        border-radius: 4px;
        background: #16213e;
        color: #e0e0e0;
        font-size: 12px;
        font-family: inherit;
        box-sizing: border-box;
      }
      #scout-name-input::placeholder {
        color: #666;
      }
      #scout-name-confirm {
        margin-top: 4px;
        padding: 4px 10px;
        background: #0f3460;
        color: #e0e0e0;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-family: inherit;
      }
    </style>
    <div id="scout-toolbar">
      <div id="scout-toolbar-header">
        <span class="grip">&#9776;</span>
        <span class="title">Scout Recording</span>
      </div>
      <div id="scout-toolbar-body">
        <div id="scout-name-input-wrapper">
          <input id="scout-name-input" type="text" placeholder="Page name (e.g., login-page, filter-panel)" />
          <button id="scout-name-confirm">Confirm & Scan</button>
        </div>
        <div id="scout-toolbar-buttons">
          <button id="scout-btn-scan">Scan</button>
          <button id="scout-btn-timed">Timed 5s</button>
          <button id="scout-btn-done">Done</button>
        </div>
        <div id="scout-toolbar-status">
          <span id="scout-pages-count">Pages: 0</span>
          <span id="scout-elements-count">Elements: 0</span>
        </div>
        <div id="scout-toolbar-message"></div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // ── State ──
  window.__scoutAction = null;
  window.__scoutPageName = '';
  window.__scoutStats = { pages: 0, elements: 0 };

  const toolbar = document.getElementById('scout-toolbar');
  const header = document.getElementById('scout-toolbar-header');
  const btnScan = document.getElementById('scout-btn-scan');
  const btnTimed = document.getElementById('scout-btn-timed');
  const btnDone = document.getElementById('scout-btn-done');
  const nameWrapper = document.getElementById('scout-name-input-wrapper');
  const nameInput = document.getElementById('scout-name-input');
  const nameConfirm = document.getElementById('scout-name-confirm');
  const msgEl = document.getElementById('scout-toolbar-message');

  // ── Draggable ──
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = toolbar.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const x = e.clientX - dragOffsetX;
    const y = e.clientY - dragOffsetY;
    toolbar.style.left = x + 'px';
    toolbar.style.top = y + 'px';
    toolbar.style.right = 'auto';
    toolbar.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // ── Show message ──
  function showMessage(text, duration) {
    msgEl.textContent = text;
    msgEl.style.display = 'block';
    if (duration) {
      setTimeout(() => { msgEl.style.display = 'none'; }, duration);
    }
  }

  // ── Page name prompt flow ──
  let pendingAction = null;

  function promptForName(action) {
    pendingAction = action;
    nameWrapper.style.display = 'block';
    nameInput.value = '';
    nameInput.focus();
  }

  function confirmName() {
    const name = nameInput.value.trim() || 'page-' + (window.__scoutStats.pages + 1);
    nameWrapper.style.display = 'none';
    window.__scoutPageName = name;

    if (pendingAction === 'scan') {
      window.__scoutAction = 'SCAN';
    } else if (pendingAction === 'timed') {
      startTimedScan(name);
    }
    pendingAction = null;
  }

  nameConfirm.addEventListener('click', confirmName);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmName();
  });

  // ── Scan button ──
  btnScan.addEventListener('click', (e) => {
    e.stopPropagation();
    promptForName('scan');
  });

  // ── Timed scan (5 second countdown) ──
  function startTimedScan(name) {
    let countdown = 5;
    btnTimed.classList.add('counting');
    btnTimed.textContent = countdown + 's';
    showMessage('Position your mouse on the target element...');

    const interval = setInterval(() => {
      countdown--;
      btnTimed.textContent = countdown + 's';
      if (countdown <= 0) {
        clearInterval(interval);
        btnTimed.classList.remove('counting');
        btnTimed.textContent = 'Timed 5s';
        msgEl.style.display = 'none';
        window.__scoutPageName = name;
        window.__scoutAction = 'SCAN';
      }
    }, 1000);
  }

  btnTimed.addEventListener('click', (e) => {
    e.stopPropagation();
    if (btnTimed.classList.contains('counting')) return; // Already counting
    promptForName('timed');
  });

  // ── Done button ──
  btnDone.addEventListener('click', (e) => {
    e.stopPropagation();
    window.__scoutAction = 'DONE';
    showMessage('Generating locator files...');
  });

  // ── Update stats (called from Scout script via page.evaluate) ──
  window.__scoutUpdateStats = function(pages, elements) {
    window.__scoutStats = { pages, elements };
    document.getElementById('scout-pages-count').textContent = 'Pages: ' + pages;
    document.getElementById('scout-elements-count').textContent = 'Elements: ' + elements;
  };

  // ── Show scan complete message ──
  window.__scoutShowMessage = function(text, duration) {
    showMessage(text, duration);
  };
}

// Self-executing
injectScoutToolbar();
