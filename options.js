async function getManagedRules() {
    try {
        const managed = await chrome.storage.managed.get("IncognitoRules");
        if (managed && Array.isArray(managed.IncognitoRules) && managed.IncognitoRules.length > 0) {
            return managed.IncognitoRules;
        }
    } catch (e) {
        // not managed
    }
    return null;
}

document.addEventListener("DOMContentLoaded", async () => {
    const textarea = document.getElementById("rules");
    const saveBtn = document.getElementById("save");

    const managedRules = await getManagedRules();

    if (managedRules) {
        // IT-controlled: show as read-only
        textarea.value = managedRules.join("\n");
        textarea.disabled = true;
        saveBtn.disabled = true;

        const note = document.createElement("p");
        note.textContent =
            "These rules are managed by your organization and cannot be changed.";
        note.style.color = "#a00";
        note.style.fontWeight = "bold";
        saveBtn.insertAdjacentElement("afterend", note);
        return;
    }

    // Local (unmanaged) mode
    const data = await chrome.storage.local.get("rules");
    textarea.value = (data.rules || []).join("\n");

    saveBtn.addEventListener("click", async () => {
        const rules = textarea.value
            .split("\n")
            .map(x => x.trim())
            .filter(Boolean);

        await chrome.storage.local.set({ rules });
        alert("Saved");
    });
});