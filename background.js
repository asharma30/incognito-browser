const DEFAULT_RULES = [];
const COOLDOWN_MS = 15000;
const TAB_LOCK_MS = 20000;

let currentRules = [];
let inactivityRules = [];
let closeOnLock = false;
let warnSeconds = 60;
let rulesAreManaged = false;

const lockedTabs = new Map();
const recentHosts = new Map();

// trackedTabs[tabId] = { timeoutMs, lastActivity, warned }
let trackedTabs = {};

async function loadTracked() {
    const d = await chrome.storage.session.get("trackedTabs");
    trackedTabs = d.trackedTabs || {};
}
function saveTracked() { chrome.storage.session.set({ trackedTabs }); }

// ---- Rule loading: managed first, then local ----
async function loadRules() {
    let m = {};
    try {
        m = await chrome.storage.managed.get(
            ["IncognitoRules", "TabInactivityRules", "CloseIncognitoOnLock", "WarnBeforeCloseSeconds"]);
    } catch (e) { m = {}; }

    if (m && Array.isArray(m.IncognitoRules) && m.IncognitoRules.length > 0) {
        currentRules = m.IncognitoRules;
        inactivityRules = Array.isArray(m.TabInactivityRules) ? m.TabInactivityRules : [];
        closeOnLock = !!m.CloseIncognitoOnLock;
        warnSeconds = Number.isInteger(m.WarnBeforeCloseSeconds) ? m.WarnBeforeCloseSeconds : 60;
        rulesAreManaged = true;
        console.log("MANAGED rules:", currentRules, "| inactivity:", inactivityRules,
                    "| closeOnLock:", closeOnLock, "| warn:", warnSeconds);
        return;
    }

    const l = await chrome.storage.local.get(
        ["rules", "inactivityRules", "closeOnLock", "warnSeconds"]);
    currentRules = l.rules || DEFAULT_RULES;
    inactivityRules = l.inactivityRules || [];
    closeOnLock = !!l.closeOnLock;
    warnSeconds = Number.isInteger(l.warnSeconds) ? l.warnSeconds : 60;
    rulesAreManaged = false;
    console.log("LOCAL rules:", currentRules, "| inactivity:", inactivityRules,
                "| closeOnLock:", closeOnLock, "| warn:", warnSeconds);
}
loadRules();

chrome.storage.onChanged.addListener((c, area) => {
    if (area === "managed") loadRules();
    if (area === "local" && !rulesAreManaged) loadRules();
});

// ---- Helpers ----
function getHostname(url) {
    try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}
function isIgnoredUrl(url) {
    return url.startsWith("edge://") || url.startsWith("chrome://") ||
           url.startsWith("about:") || url.startsWith("file:") ||
           url.startsWith("chrome-extension://") || url.startsWith("extension://") ||
           url.includes("options.html");
}
function ruleMatchesHost(rule, hostname) {
    rule = String(rule).toLowerCase().trim();
    if (rule === "") return false;
    if (rule.startsWith("*.")) {
        const d = rule.substring(2);
        return hostname === d || hostname.endsWith("." + d);
    }
    return hostname === rule;
}
function hostMatches(hostname) {
    return currentRules.some(r => ruleMatchesHost(r, hostname));
}
function getInactivityMinutes(hostname) {
    for (const r of inactivityRules) {
        if (r && r.host && ruleMatchesHost(r.host, hostname)) {
            const min = parseInt(r.minutes, 10);
            if (!isNaN(min) && min > 0) return min;
        }
    }
    return null;
}
function isLocked(tabId, hostname) {
    const now = Date.now();
    const t = lockedTabs.get(tabId);
    if (t && now - t < TAB_LOCK_MS) return true;
    const h = recentHosts.get(hostname);
    if (h && now - h < COOLDOWN_MS) return true;
    return false;
}
function lock(tabId, hostname) {
    const now = Date.now();
    lockedTabs.set(tabId, now);
    recentHosts.set(hostname, now);
}

// ---- Routing (IncognitoRules) ----
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const url = changeInfo.url || tab.url;
    if (!url || tab.incognito || isIgnoredUrl(url)) return;
    const hostname = getHostname(url);
    if (!hostname) return;
    if (isLocked(tabId, hostname)) return;
    if (!hostMatches(hostname)) return;
    lock(tabId, hostname);
    routeToIncognito(tabId, url, hostname);
});

async function routeToIncognito(originalTabId, url, hostname) {
    console.log("MATCH:", url, "| tabId:", originalTabId);
    let win = null;
    try {
        win = await chrome.windows.create({ url, incognito: true });
        console.log("Opened InPrivate for:", hostname);
    } catch (e) { console.error("Open failed:", e); return; }
    try {
        await chrome.tabs.remove(originalTabId);
        console.log("Closed original tab:", originalTabId);
    } catch (e) { console.warn("Close original failed:", e); }
}

// ---- Inactivity tracking (TabInactivityRules) - any tab, incognito or normal ----
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;
    const url = tab.url || "";
    if (!url || isIgnoredUrl(url)) return;
    const hostname = getHostname(url);
    if (!hostname) return;

    await loadTracked();
    const minutes = getInactivityMinutes(hostname);

    if (minutes) {
        trackedTabs[tabId] = { timeoutMs: minutes * 60000, lastActivity: Date.now(), warned: false };
        saveTracked();
        try {
            await chrome.scripting.executeScript({ target: { tabId }, files: ["activity-tracker.js"] });
        } catch (e) { console.warn("Inject failed:", e); }
        console.log(`Tracking tab ${tabId} (${hostname}) - ${minutes} min`);
    } else if (trackedTabs[tabId]) {
        // navigated away from a tracked host -> stop tracking
        delete trackedTabs[tabId];
        saveTracked();
    }
});

// ---- Activity pings reset the tab's timer ----
chrome.runtime.onMessage.addListener(async (msg, sender) => {
    if (!msg || msg.type !== "activity" || !sender.tab) return;
    const tabId = sender.tab.id;
    await loadTracked();
    if (trackedTabs[tabId]) {
        trackedTabs[tabId].lastActivity = Date.now();
        if (trackedTabs[tabId].warned) {
            trackedTabs[tabId].warned = false;
            try { chrome.tabs.sendMessage(tabId, { type: "clear" }); } catch (e) {}
        }
        saveTracked();
    }
});

// ---- Periodic check (every 30s) ----
chrome.alarms.create("idleCheck", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(async (a) => {
    if (a.name !== "idleCheck") return;
    await loadTracked();
    const now = Date.now();
    let changed = false;

    for (const idStr of Object.keys(trackedTabs)) {
        const tabId = Number(idStr);
        const info = trackedTabs[idStr];
        const idle = now - info.lastActivity;

        if (idle >= info.timeoutMs) {
            try { await chrome.tabs.remove(tabId); console.log("Closed inactive tab:", tabId); }
            catch (e) {}
            delete trackedTabs[idStr];
            changed = true;
        } else if (warnSeconds > 0 && idle >= info.timeoutMs - warnSeconds * 1000) {
            if (!info.warned) {
                const secsLeft = Math.max(1, Math.round((info.timeoutMs - idle) / 1000));
                try { chrome.tabs.sendMessage(tabId, { type: "warn", seconds: secsLeft }); } catch (e) {}
                info.warned = true;
                changed = true;
            }
        }
    }
    if (changed) saveTracked();
});

// ---- Screen lock backstop (admin toggle) ----
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(async (state) => {
    if (state !== "locked" || !closeOnLock) return;
    try {
        const wins = await chrome.windows.getAll({});
        for (const w of wins) {
            if (w.incognito) {
                try { await chrome.windows.remove(w.id); console.log("Lock: closed incognito window", w.id); }
                catch (e) {}
            }
        }
    } catch (e) {}
    await loadTracked();
    trackedTabs = {};
    saveTracked();
});

// ---- Cleanup ----
chrome.tabs.onRemoved.addListener(async (tabId) => {
    lockedTabs.delete(tabId);
    await loadTracked();
    if (trackedTabs[tabId]) { delete trackedTabs[tabId]; saveTracked(); }
});

setInterval(() => {
    const now = Date.now();
    for (const [id, t] of lockedTabs) if (now - t > TAB_LOCK_MS) lockedTabs.delete(id);
    for (const [h, t] of recentHosts) if (now - t > COOLDOWN_MS) recentHosts.delete(h);
}, 10000);
