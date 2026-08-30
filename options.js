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

document.addEventListener("DOMContentLoaded", async () => {
    const rulesBox = document.getElementById("rules");
    const inactBox = document.getElementById("inactivity");
    const lockChk = document.getElementById("closeOnLock");
    const warnNum = document.getElementById("warnSeconds");
    const saveBtn = document.getElementById("save");

    const managed = await getManaged();
    if (managed) {
        rulesBox.value = managed.IncognitoRules.join("\n");
        inactBox.value = inactToText(managed.TabInactivityRules);
        lockChk.checked = !!managed.CloseIncognitoOnLock;
        warnNum.value = Number.isInteger(managed.WarnBeforeCloseSeconds) ? managed.WarnBeforeCloseSeconds : 60;
        [rulesBox, inactBox, lockChk, warnNum, saveBtn].forEach(el => el.disabled = true);
        const note = document.createElement("p");
        note.textContent = "These settings are managed by your organization and cannot be changed.";
        note.style.color = "#a00"; note.style.fontWeight = "bold";
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