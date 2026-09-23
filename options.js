async function getManaged() {
    try {
        const m = await chrome.storage.managed.get(
            ["IncognitoRules", "TabInactivityRules", "CloseIncognitoOnLock", "WarnBeforeCloseSeconds"]);
        if (m && Array.isArray(m.IncognitoRules) && m.IncognitoRules.length > 0) return m;
    } catch (e) {}
    return null;
}

function inactToText(list) {
    return (list || []).filter(r => r && r.host).map(r => `${r.host}, ${r.minutes}`).join("\n");
}

function textToInact(text) {
    return text.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
        const p = l.split(",");
        const host = (p[0] || "").trim();
        const minutes = parseInt((p[1] || "").trim(), 10);
        return host && !isNaN(minutes) ? { host, minutes } : null;
    }).filter(Boolean);
}

function pad(n) { return n < 10 ? "0" + n : "" + n; }

function formatDateTime(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fileDateStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function refreshLogSummary() {
    const d = await chrome.storage.local.get("activityLog");
    const log = d.activityLog || [];
    const el = document.getElementById("logSummary");

    if (log.length === 0) {
        el.textContent = "No events recorded yet.";
        return;
    }

    const oldest = formatDateTime(log[0].t);
    const newest = formatDateTime(log[log.length - 1].t);
    el.textContent = `${log.length} event(s) recorded, from ${oldest} to ${newest}.`;
}

async function exportLogCsv() {
    const d = await chrome.storage.local.get("activityLog");
    const log = d.activityLog || [];

    if (log.length === 0) {
        alert("No events to export.");
        return;
    }

    const rows = ["Timestamp,Site,Reason"];
    for (const e of log) {
        rows.push(`"${formatDateTime(e.t)}","${e.h}","${e.r}"`);
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `incognito-router-log-${fileDateStamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

document.addEventListener("DOMContentLoaded", async () => {
    const rulesBox = document.getElementById("rules");
    const inactBox = document.getElementById("inactivity");
    const lockChk = document.getElementById("closeOnLock");
    const warnNum = document.getElementById("warnSeconds");
    const saveBtn = document.getElementById("save");
    const exportBtn = document.getElementById("exportLog");

    // Export is always available, managed or not
    exportBtn.addEventListener("click", exportLogCsv);
    refreshLogSummary();

    const managed = await getManaged();
    if (managed) {
        rulesBox.value = managed.IncognitoRules.join("\n");
        inactBox.value = inactToText(managed.TabInactivityRules);
        lockChk.checked = !!managed.CloseIncognitoOnLock;
        warnNum.value = Number.isInteger(managed.WarnBeforeCloseSeconds) ? managed.WarnBeforeCloseSeconds : 60;
        [rulesBox, inactBox, lockChk, warnNum, saveBtn].forEach(el => el.disabled = true);

        const note = document.createElement("p");
        note.textContent = "These settings are managed by your organization and cannot be changed.";
        note.style.color = "#a00";
        note.style.fontWeight = "bold";
        saveBtn.insertAdjacentElement("afterend", note);
        return;
    }

    const d = await chrome.storage.local.get(["rules", "inactivityRules", "closeOnLock", "warnSeconds"]);
    rulesBox.value = (d.rules || []).join("\n");
    inactBox.value = inactToText(d.inactivityRules);
    lockChk.checked = !!d.closeOnLock;
    warnNum.value = Number.isInteger(d.warnSeconds) ? d.warnSeconds : 60;

    saveBtn.addEventListener("click", async () => {
        await chrome.storage.local.set({
            rules: rulesBox.value.split("\n").map(x => x.trim()).filter(Boolean),
            inactivityRules: textToInact(inactBox.value),
            closeOnLock: lockChk.checked,
            warnSeconds: parseInt(warnNum.value, 10) || 0
        });
        alert("Saved");
    });
});