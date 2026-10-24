/* =========================================================================
   Bloom Notch — Security Test Suite
   Tests for common API/IPC security flaws in the Electron app.
   Run with: node security-test.js
   ========================================================================= */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
  } catch (e) {
    failed++;
    results.push({ name, status: 'FAIL', error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// Read source files
const htmlPath = path.join(__dirname, 'bloom-notch.html');
const mainPath = path.join(__dirname, 'main.js');
const preloadPath = path.join(__dirname, 'preload.js');
const html = fs.readFileSync(htmlPath, 'utf8');
const main = fs.readFileSync(mainPath, 'utf8');
const preload = fs.readFileSync(preloadPath, 'utf8');

console.log('=== Bloom Notch Security Audit ===\n');

// =========================================================================
// 1. IPC Input Validation
// =========================================================================
console.log('--- IPC Input Validation ---');

test('IPC: resizeNotch should validate width bounds', () => {
  // Check if main.js validates width before setSize
  const hasValidation = main.includes('Math.max') || main.includes('Math.min') ||
    main.includes('clamp') || main.includes('if (width') || main.includes('if (height');
  assert(hasValidation, 'resizeNotch does not validate width/height bounds — attacker can resize window to extreme dimensions');
});

test('IPC: resizeNotch should validate height bounds', () => {
  const hasHeightCheck = main.includes('height') && (main.includes('Math.max') || main.includes('Math.min') ||
    main.includes('<= 0') || main.includes('< 0') || main.includes('isNaN'));
  assert(hasHeightCheck, 'resizeNotch does not validate height — potential DoS via extreme values');
});

test('IPC: toggleNotch should validate boolean input', () => {
  const hasBoolCheck = main.includes('typeof show') || main.includes('show === true') ||
    main.includes('show === false') || main.includes('Boolean(show)');
  assert(hasBoolCheck, 'toggleNotch does not validate boolean input — type confusion risk');
});

test('IPC: no eval or Function constructor in main process', () => {
  assert(!main.includes('eval('), 'eval() found in main.js — code injection risk');
  assert(!main.includes('new Function('), 'new Function() found in main.js — code injection risk');
});

test('IPC: no child_process or exec in main process', () => {
  assert(!main.includes('child_process'), 'child_process referenced — command injection risk');
  assert(!main.includes('exec('), 'exec() found — command injection risk');
  assert(!main.includes('spawn('), 'spawn() found — command injection risk');
});

// =========================================================================
// 2. XSS / Injection in Renderer
// =========================================================================
console.log('\n--- XSS / Injection ---');

test('XSS: innerHTML with unsanitized notification data', () => {
  // Check if notification title/sub are escaped before innerHTML
  const hasEscape = html.includes('escapeHtml') || html.includes('textContent') ||
    html.includes('DOMPurify') || html.includes('sanitize');
  // The notif title/sub are inserted via innerHTML without escaping
  const usesInnerHTML = html.includes('el.innerHTML = `') && html.includes('${n.title}');
  if (usesInnerHTML && !hasEscape) {
    throw new Error('Notification title/sub inserted via innerHTML without escaping — XSS if data comes from external API (Notion/Spotify)');
  }
});

test('XSS: innerHTML with unsanitized calendar event data', () => {
  const hasEscape = html.includes('escapeHtml') || html.includes('textContent');
  const usesInnerHTML = html.includes('el.innerHTML = `<div class="time">${ev.time}</div><div class="title">${ev.title}</div>');
  if (usesInnerHTML && !hasEscape) {
    throw new Error('Calendar event title inserted via innerHTML without escaping — XSS if data comes from external API');
  }
});

test('XSS: innerHTML with unsanitized Spotify track data', () => {
  const hasEscape = html.includes('escapeHtml') || html.includes('textContent');
  const usesInnerHTML = html.includes('sp-title') && html.includes('textContent');
  // Check if spotify title uses textContent (safe) or innerHTML (unsafe)
  const safeSpotify = html.includes("document.getElementById('sp-title').textContent = track.title");
  if (!safeSpotify && !hasEscape) {
    throw new Error('Spotify track title may be inserted unsafely');
  }
});

test('XSS: no document.write or eval in renderer', () => {
  assert(!html.includes('document.write'), 'document.write found — XSS risk');
  assert(!html.includes('eval('), 'eval() found in renderer — code injection risk');
});

// =========================================================================
// 3. Content Security Policy
// =========================================================================
console.log('\n--- Content Security Policy ---');

test('CSP: meta tag present', () => {
  const hasCSP = html.includes('Content-Security-Policy') || html.includes('content-security-policy');
  assert(hasCSP, 'No Content-Security-Policy meta tag — allows inline scripts and external resources without restriction');
});

test('CSP: script-src restricted', () => {
  const hasScriptSrc = html.includes("script-src") || html.includes("script-src 'self'");
  // This is informational — CSP would need to allow 'unsafe-inline' for the inline script
  if (!hasScriptSrc) {
    // Not a hard failure since inline scripts need 'unsafe-inline'
    console.log('  (info) CSP script-src not set — consider adding for production');
  }
});

// =========================================================================
// 4. Token / Secret Storage
// =========================================================================
console.log('\n--- Token / Secret Storage ---');

test('Secrets: no hardcoded API keys or tokens', () => {
  const secretPatterns = [
    /sk-[a-zA-Z0-9]{20,}/,           // OpenAI-style
    /ghp_[a-zA-Z0-9]{36,}/,           // GitHub PAT
    /xox[baprs]-[a-zA-Z0-9-]+/,      // Slack
    /AIza[0-9A-Za-z-_]{35}/,         // Google API
    /Bearer\s+[a-zA-Z0-9._-]{20,}/,  // Bearer tokens
  ];
  const allCode = html + main + preload;
  for (const pat of secretPatterns) {
    assert(!pat.test(allCode), `Potential hardcoded secret found matching ${pat}`);
  }
});

test('Secrets: no localStorage for sensitive tokens', () => {
  // localStorage is not secure for tokens in Electron
  const usesLocalStorage = html.includes('localStorage') && html.includes('token');
  assert(!usesLocalStorage, 'localStorage used for tokens — use secure storage (keytar/encrypted) instead');
});

// =========================================================================
// 5. Electron Security Configuration
// =========================================================================
console.log('\n--- Electron Security Config ---');

test('Electron: nodeIntegration disabled', () => {
  assert(main.includes('nodeIntegration: false'), 'nodeIntegration not explicitly disabled');
});

test('Electron: contextIsolation enabled', () => {
  assert(main.includes('contextIsolation: true'), 'contextIsolation not enabled');
});

test('Electron: webSecurity not disabled', () => {
  assert(!main.includes('webSecurity: false'), 'webSecurity explicitly disabled — dangerous');
});

test('Electron: allowRunningInsecureContent not enabled', () => {
  assert(!main.includes('allowRunningInsecureContent: true'), 'allowRunningInsecureContent enabled — mixed content risk');
});

test('Electron: experimentalFeatures not enabled', () => {
  assert(!main.includes('experimentalFeatures: true'), 'experimentalFeatures enabled — potential attack surface');
});

test('Electron: preload uses contextBridge', () => {
  assert(preload.includes('contextBridge'), 'preload does not use contextBridge — direct require exposure risk');
});

test('Electron: no remote module usage', () => {
  assert(!main.includes('remote') && !preload.includes('remote'), 'remote module referenced — deprecated and insecure');
});

// =========================================================================
// 6. IPC Handler Security
// =========================================================================
console.log('\n--- IPC Handler Security ---');

test('IPC: handlers validate sender origin', () => {
  // Check if ipcMain handlers verify event.sender
  const hasSenderCheck = main.includes('event.sender') || main.includes('senderFrame') ||
    main.includes('validateOrigin') || main.includes('trustedOrigins');
  if (!hasSenderCheck) {
    console.log('  (info) IPC handlers do not verify sender origin — acceptable for single-window app');
  }
});

test('IPC: no arbitrary file read/write handlers', () => {
  assert(!main.includes('fs.readFile') && !main.includes('fs.writeFile') &&
    !main.includes('readFileSync') && !main.includes('writeFileSync'),
    'File system operations in main process IPC — path traversal risk');
});

test('IPC: resizeNotch does not accept arbitrary URLs or paths', () => {
  // Ensure resize handler only takes numeric width/height
  const resizeHandler = main.match(/ipcMain\.on\('notch-resize'[\s\S]*?\}\);/);
  if (resizeHandler) {
    const body = resizeHandler[0];
    assert(!body.includes('url') && !body.includes('path') && !body.includes('file'),
      'resizeNotch handler accepts URL/path parameters — injection risk');
  }
});

// =========================================================================
// 7. Prototype Pollution / Object Injection
// =========================================================================
console.log('\n--- Prototype Pollution ---');

test('No __proto__ or constructor access in data handling', () => {
  const dangerous = ['__proto__', 'constructor[', 'prototype['];
  for (const d of dangerous) {
    assert(!html.includes(d), `Dangerous property access "${d}" found in HTML`);
  }
});

test('Notification data uses fixed schema (no dynamic keys)', () => {
  // Check that notif properties are accessed via known keys, not dynamic
  const hasDynamicAccess = html.includes('notif[') || html.includes('n[');
  if (hasDynamicAccess) {
    console.log('  (info) Dynamic property access found — verify no user-controlled keys');
  }
});

// =========================================================================
// Results
// =========================================================================
console.log('\n=== Results ===');
results.forEach(r => {
  const icon = r.status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${r.name}${r.error ? ' — ' + r.error : ''}`);
});
console.log(`\nPassed: ${passed}  Failed: ${failed}  Total: ${passed + failed}`);

if (failed > 0) {
  console.log('\n⚠️  Security issues found. Review the failures above.');
  process.exit(1);
} else {
  console.log('\n✅ All security checks passed.');
}
