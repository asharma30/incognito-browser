// Injected into tabs that have a TabInactivityRule.
// Reports activity to the background and shows a countdown warning banner.
(function () {
    if (window.__irTracker) return;
    window.__irTracker = true;

    let lastSent = 0;
    let banner = null;
    let countdownTimer = null;

    function sendActivity() {
        const now = Date.now();
        if (now - lastSent < 5000) return; // throttle to once / 5s
        lastSent = now;
        try { chrome.runtime.sendMessage({ type: "activity" }); } catch (e) {}
        clearBanner();
    }

    ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click", "wheel"]
        .forEach(ev => window.addEventListener(ev, sendActivity, { passive: true, capture: true }));

    function clearBanner() {
        if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
        if (banner) { banner.remove(); banner = null; }
    }

    function showBanner(seconds) {
        clearBanner();
        let remaining = seconds;

        banner = document.createElement("div");
        banner.style.cssText = [
            "position:fixed", "top:0", "left:0", "right:0", "z-index:2147483647",
            "background:#b30000", "color:#fff", "font:600 14px Segoe UI, Arial, sans-serif",
            "padding:10px 16px", "text-align:center", "box-shadow:0 2px 6px rgba(0,0,0,.3)"
        ].join(";");

        const text = document.createElement("span");
        const btn = document.createElement("button");
        btn.textContent = "Keep me signed in";
        btn.style.cssText =
            "margin-left:14px;padding:4px 12px;border:0;border-radius:4px;cursor:pointer;font-weight:600;";
        btn.addEventListener("click", () => { lastSent = 0; sendActivity(); });

        function render() {
            text.textContent =
                `For your security, this session will close in ${remaining}s due to inactivity.`;
        }
        render();
        banner.appendChild(text);
        banner.appendChild(btn);
        document.documentElement.appendChild(banner);

        countdownTimer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) { clearBanner(); return; }
            render();
        }, 1000);
    }

    chrome.runtime.onMessage.addListener((msg) => {
        if (!msg) return;
        if (msg.type === "warn") showBanner(msg.seconds);
        if (msg.type === "clear") clearBanner();
    });

    // announce presence so background resets timer on load
    try { chrome.runtime.sendMessage({ type: "activity" }); } catch (e) {}
})();