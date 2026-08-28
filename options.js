document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const data =
            await chrome.storage.local.get(
                "rules"
            );

        document.getElementById(
            "rules"
        ).value =
            (data.rules || [])
                .join("\n");
    }
);

document.getElementById(
    "save"
).addEventListener(
    "click",
    async () => {

        const rules =
            document
                .getElementById("rules")
                .value
                .split("\n")
                .map(x => x.trim())
                .filter(Boolean);

        await chrome.storage.local.set({
            rules
        });

        alert("Saved");
    }
);