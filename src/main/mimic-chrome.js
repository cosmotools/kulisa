// Make an embedded profile present itself as Google Chrome of the same engine version (author's decision, SPEC §8).
// Covers what sites read directly: the User-Agent (reduced, like Chrome), Sec-CH-UA* headers and
// navigator.userAgentData. Uses Chromium's own override (CDP Emulation.setUserAgentOverride), so headers and JS agree.
// Not covered: Widevine, Google API keys, Chrome-only APIs, device compliance (Entra Conditional Access, etc.).
// Only the brands are Chrome's own. Everything about the machine (OS, its version, CPU) is what Electron's
// Chromium reports itself, computed by the same code as in Chrome, so it is right on every OS without a table here.
const { app } = require('electron');

// Chromium's brand list for a major version (components/embedder_support/user_agent_utils.cc).
function brandList(major, fullVersion, full) {
  const seed = Number(major);
  const chars = [' ', '(', ':', '-', '.', '/', ')', ';', '=', '?', '_'];
  const greaseVersions = ['8', '99', '24'];
  const greaseBrand = `Not${chars[seed % chars.length]}A${chars[(seed + 1) % chars.length]}Brand`;
  const greaseMajor = greaseVersions[seed % greaseVersions.length];
  const v = (x) => (full ? fullVersion : major);
  const grease = { brand: greaseBrand, version: full ? `${greaseMajor}.0.0.0` : greaseMajor };
  const chromium = { brand: 'Chromium', version: v() };
  const chrome = { brand: 'Google Chrome', version: v() };
  const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const order = orders[seed % orders.length];
  const list = [];
  list[order[0]] = grease; list[order[1]] = chromium; list[order[2]] = chrome;
  return list;
}

// What Chromium reports for this machine, read from a page without an override (the shell window; it must be a
// secure context, which file: is). The UA's platform part comes from Electron's default UA, already reduced as in
// Chrome (e.g. "Macintosh; Intel Mac OS X 10_15_7").
async function nativeIdentity(wc) {
  const hints = await wc.executeJavaScript(
    "navigator.userAgentData.getHighEntropyValues(['platform', 'platformVersion', 'architecture', 'bitness', 'wow64'])");
  const uaPlatform = app.userAgentFallback.match(/^Mozilla\/5\.0 \(([^)]+)\)/)[1];
  return { platform: hints.platform, platformVersion: hints.platformVersion, architecture: hints.architecture,
    bitness: hints.bitness, wow64: hints.wow64, uaPlatform };
}

// native: from nativeIdentity().
function chromeIdentity(native) {
  const fullVersion = process.versions.chrome;
  const major = fullVersion.split('.')[0];
  const { platform, platformVersion, architecture: arch, bitness, wow64, uaPlatform } = native;
  const userAgent = `Mozilla/5.0 (${uaPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
  const metadata = {
    brands: brandList(major, fullVersion, false), fullVersionList: brandList(major, fullVersion, true), fullVersion,
    platform, platformVersion, architecture: arch, model: '', mobile: false, bitness, wow64, formFactors: ['Desktop'],
  };
  const fmt = (l) => l.map((b) => `"${b.brand}";v="${b.version}"`).join(', ');
  const q = (x) => `"${x}"`;
  // Low-entropy hints Chrome sends on every request to a secure origin; the rest only after Accept-CH.
  const lowEntropy = { 'sec-ch-ua': fmt(metadata.brands), 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': q(platform) };
  const highEntropy = {
    'sec-ch-ua-full-version-list': fmt(metadata.fullVersionList), 'sec-ch-ua-full-version': q(fullVersion),
    'sec-ch-ua-platform-version': q(metadata.platformVersion), 'sec-ch-ua-arch': q(arch), 'sec-ch-ua-bitness': q(bitness),
    'sec-ch-ua-model': q(''), 'sec-ch-ua-wow64': wow64 ? '?1' : '?0', 'sec-ch-ua-form-factors': q('Desktop'),
  };
  const headers = { ...lowEntropy, ...highEntropy };
  return { userAgent, metadata, headers, lowEntropy, highEntropy };
}

// Session level: UA for every request, and Sec-CH-UA* for requests Chromium leaves bare:
// - Electron sends no UA-CH at all on navigation requests (main frame, iframes), unlike Chrome;
// - the first request of a popup leaves before the tab's CDP override is in place.
// High-entropy hints are added only for origins that asked for them with Accept-CH, as Chrome does.
function applyToSession(session, id) {
  session.setUserAgent(id.userAgent);
  const accepted = new Map(); // origin -> Set of hint header names
  const secure = (u) => u.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  session.webRequest.onHeadersReceived((details, cb) => {
    const h = Object.entries(details.responseHeaders || {}).find(([k]) => k.toLowerCase() === 'accept-ch');
    if (h) { try { accepted.set(new URL(details.url).origin, new Set(String(h[1]).toLowerCase().split(/\s*,\s*/))); } catch {} }
    cb({});
  });
  session.webRequest.onBeforeSendHeaders((details, cb) => {
    const h = details.requestHeaders;
    let u; try { u = new URL(details.url); } catch { return cb({ requestHeaders: h }); }
    if (!secure(u)) return cb({ requestHeaders: h });
    const present = new Map(Object.keys(h).map((k) => [k.toLowerCase(), k]));
    const set = (name, value) => { if (present.has(name)) h[present.get(name)] = value; else h[name] = value; };
    for (const [k, v] of Object.entries(id.lowEntropy)) set(k, v);
    const asked = accepted.get(u.origin) || new Set();
    for (const [k, v] of Object.entries(id.highEntropy)) if (present.has(k) || asked.has(k)) set(k, v);
    cb({ requestHeaders: h });
  });
  return id;
}

// Tab level: navigator.userAgentData and the headers Chromium builds from it.
async function applyToWebContents(wc, id) {
  if (wc.isDestroyed()) return;
  if (!wc.debugger.isAttached()) wc.debugger.attach('1.3');
  await wc.debugger.sendCommand('Emulation.setUserAgentOverride', { userAgent: id.userAgent, userAgentMetadata: id.metadata });
}

module.exports = { nativeIdentity, chromeIdentity, applyToSession, applyToWebContents, brandList };
