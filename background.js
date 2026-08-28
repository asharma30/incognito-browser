const DEFAULT_RULES = [];
const COOLDOWN_MS = 15000;
const TAB_LOCK_MS = 20000;

let currentRules = [];
let rulesAreManaged = false;

const lockedTabs = new Map();
const recentHosts = new Map();

// ---- Rule loading: managed (IT policy) first, then local ----

async function loadRules() {
    let managed = {};
    try {
        managed = await chrome.storage.managed.get("IncognitoRules");
    } catch (e) {
        // managed storage may be unavailable on unmanaged devices
        managed = {};
    }

    if (managed && Array.isArray(managed.IncognitoRules) && managed.IncognitoRules.length > 0) {
        currentRules = managed.IncognitoRules;
        rulesAreManaged = true;
        console.log("Rules loaded from MANAGED policy:", currentRules);
        return;
    }

    const local = await chrome.storage.local.get("rules");
    currentRules = local.rules || DEFAULT_RULES;
    rulesAreManaged = false;
    console.log("Rules loaded from LOCAL storage:", currentRules);
}

loadRules();

// Reload when either policy or local rules change.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "managed" && changes.IncognitoRules) {
        loadRules();
    }
    if (area === "local" && changes.rules && !rulesAreManaged) {
        loadRules();
    }
});

// ---- Helpers ----

function getHostname(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return null;
    }
}

function isIgnoredUrl(url) {
    return (
        url.startsWith("edge://") ||
        url.startsWith("chrome://") ||
        url.startsWith("about:") ||
        url.startsWith("file:") ||
        url.startsWith("chrome-extension://") ||
        url.startsWith("extension://") ||
        url.includes("options.html")
    );
}

function hostMatches(hostname) {
    return currentRules.some(raw => {
        const rule = String(raw).toLowerCase().trim();
        if (rule === "") return false;
        if (rule.startsWith("*.")) {
            const domain = rule.substring(2);
            return hostname === domain || hostname.endsWith("." + domain);
        }
        return hostname === rule;
    });
}

function isLocked(tabId, hostname) {
    const now = Date.now();
    const tabTime = lockedTabs.get(tabId);
    if (tabTime && now - tabTime < TAB_LOCK_MS) return true;
    const hostTime = recentHosts.get(hostname);
    if (hostTime && now - hostTime < COOLDOWN_MS) return true;
    return false;
}

function lock(tabId, hostname) {
    const now = Date.now();
    lockedTabs.set(tabId, now);
    recentHosts.set(hostname, now);
}

// ---- Main listener ----

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const url = changeInfo.url || tab.url;
    if (!url) return;
    if (tab.incognito) return;
    if (isIgnoredUrl(url)) return;

    const hostname = getHostname(url);
    if (!hostname) return;

    if (isLocked(tabId, hostname)) return;
    if (!hostMatches(hostname)) return;

    lock(tabId, hostname);
    routeToIncognito(tabId, url, hostname);
});

async function routeToIncognito(tabId, url, hostname) {
    console.log("MATCH:", url, "| tabId:", tabId);

    let newWindow = null;
    try {
        newWindow = await chrome.windows.create({ url: url, incognito: true });
        console.log("Opened InPrivate window for:", hostname);
    } catch (error) {
        console.error("Failed to open InPrivate window:", error);
        return;
    }

    console.log("Attempting to close original tab:", tabId);
    try {
        await chrome.tabs.remove(tabId);
        console.log("Closed original tab:", tabId);
    } catch (error) {
        console.warn("Could not close original tab:", tabId, error);
    }
}

chrome.tabs.onRemoved.addListener((tabId) => {
    lockedTabs.delete(tabId);
});

setInterval(() => {
    const now = Date.now();
    for (const [tabId, t] of lockedTabs) {
        if (now - t > TAB_LOCK_MS) lockedTabs.delete(tabId);
    }
    for (const [host, t] of recentHosts) {
        if (now - t > COOLDOWN_MS) recentHosts.delete(host);
    }
}, 10000);