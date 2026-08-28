const DEFAULT_RULES = [];

// Prevent duplicate redirects
const recentRedirects = new Map();

// Track already-processed tabs
const processedTabs = new Set();

function urlMatches(url, rules) {

    try {

        const hostname =
            new URL(url).hostname.toLowerCase();

        return rules.some(rule => {

            rule = rule.toLowerCase().trim();

            // Support wildcard rules (*.okta.com)
            if (rule.startsWith("*.")) {

                const domain =
                    rule.substring(2);

                return (
                    hostname === domain ||
                    hostname.endsWith("." + domain)
                );
            }

            // Exact hostname rule
            return hostname === rule;

        });

    }
    catch {

        return false;

    }
}

chrome.webNavigation.onBeforeNavigate.addListener(
    async (details) => {

        // Only process main frame
        if (details.frameId !== 0)
            return;

        // Ignore browser & extension pages
        if (
            details.url.startsWith("edge://") ||
            details.url.startsWith("chrome://") ||
            details.url.startsWith("about:") ||
            details.url.startsWith("file:") ||
            details.url.includes("options.html") ||
            details.url.startsWith("chrome-extension://")
        ) {
            return;
        }

        try {

            let tab;

            try {

                tab = await chrome.tabs.get(
                    details.tabId
                );

            }
            catch {

                return;

            }

            // Don't re-process incognito tabs
            if (tab.incognito)
                return;

            // Already handled this tab
            if (
                processedTabs.has(
                    details.tabId
                )
            ) {
                return;
            }

            const hostname =
                new URL(details.url)
                    .hostname
                    .toLowerCase();

            const now = Date.now();

            // Hostname cooldown
            const previousTime =
                recentRedirects.get(
                    hostname
                );

            if (
                previousTime &&
                now - previousTime < 10000
            ) {

                console.log(
                    "Cooldown hit:",
                    hostname
                );

                return;

            }

            const data =
                await chrome.storage.local.get(
                    "rules"
                );

            const rules =
                data.rules || DEFAULT_RULES;

            console.log(
                "Loaded Rules:",
                rules
            );

            if (
                !urlMatches(
                    details.url,
                    rules
                )
            ) {
                return;
            }

            console.log(
                "MATCH FOUND:",
                details.url
            );

            processedTabs.add(
                details.tabId
            );

            recentRedirects.set(
                hostname,
                now
            );

            const originalTabId =
                details.tabId;

            console.log(
                "Opening InPrivate window..."
            );

            const newWindow =
                await chrome.windows.create({
                    url: details.url,
                    incognito: true
                });

            console.log(
                "Opened InPrivate:",
                hostname
            );

            if (
                newWindow &&
                originalTabId
            ) {

                try {

                    await chrome.tabs.remove(
                        originalTabId
                    );

                    console.log(
                        "SUCCESSFULLY CLOSED TAB:",
                        originalTabId
                    );

                }
                catch (error) {

                    console.error(
                        "FAILED TO CLOSE TAB:",
                        error
                    );

                }

            }

        }
        catch (error) {

            console.error(
                "ROUTER ERROR:",
                error
            );

        }

    }
);