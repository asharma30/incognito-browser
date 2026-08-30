# 🕵️ Incognito Router

A Microsoft Edge & Google Chrome browser extension that automatically routes designated websites into an **InPrivate/Incognito** session — with optional **per-site inactivity auto-close** for shared and high-sensitivity workstations.

Works two ways:
- **Personal use** — install it, add your own rules on the options page. No policy required.
- **Enterprise use** — routing rules and security behavior are **centrally managed by IT policy** and locked from end-user modification.

---

## 📑 Table of Contents
- [What It Does](#-what-it-does)
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Installation](#-installation)
- [Rule Formats](#-rule-formats)
- [Personal Setup (Unmanaged)](#-personal-setup-unmanaged)
- [Admin Governance Guide](#-admin-governance-guide)
- [Deployment (Managed / Enterprise)](#-deployment-managed--enterprise)
- [Commands — Admin Setup Script](#-commands--admin-setup-script)
- [Verification Commands](#-verification-commands)
- [Quick Reference Sheet](#-quick-reference-sheet)
- [Configuration Data Types](#-configuration-data-types)
- [Troubleshooting](#-troubleshooting)
- [Privacy](#-privacy)
- [Version History](#-version-history)

---

## 🎯 What It Does

When a user navigates to a configured site, Incognito Router:

1. **Reopens** that site in an InPrivate/Incognito window
2. **Closes** the original tab
3. *(Optional)* **Auto-closes** the session tab after a period of inactivity
4. *(Optional)* **Closes all Incognito windows** when the workstation screen locks

This keeps sensitive sessions isolated and ensures a **clean slate for the next user** on shared workstations.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Incognito routing** | Auto-opens matching sites in InPrivate/Incognito |
| **Wildcard + exact matching** | `*.appname.com` or `www.example.com` |
| **Per-tab inactivity auto-close** | Closes a tab after N minutes of no activity (works in Incognito **or** normal tabs) |
| **Inactivity warning banner** | On-page countdown with a **"Keep me signed in"** button |
| **Screen-lock backstop** | *(Optional)* closes all Incognito windows on screen lock |
| **Flexible configuration** | Personal (local) **or** centrally managed by IT policy |
| **Cross-browser** | Microsoft Edge & Google Chrome |
| **Loop & duplicate protection** | Hostname cooldown + tab locking |

---

## ⚙️ How It Works

```
User navigates to a matched URL
          │
          ▼
   Opens in Incognito  ──►  Original tab closes
          │
          ▼
 (If inactivity rule set)
   Timer starts on that tab
          │
   ┌──────┴───────┐
   │              │
 Activity       No activity
 resets timer   for N minutes
   │              │
   │              ▼
   │        Warning banner (countdown)
   │              │
   │        No activity → tab closes
   ▼
 (Screen lock, if enabled) ──► all Incognito windows close
```

**Key behavior:** Inactivity tracking is **per-tab** — a session closes if *that specific tab* is abandoned, even if the user is active elsewhere in the browser. This is intentional and correct for individual confidential apps.

---

## 📥 Installation

There are **two ways** to install Incognito Router.

### Option A — Microsoft Edge Add-ons (Hidden listing)
The extension is published as **hidden/unlisted**, so it won't appear in store search.
- **Message the maintainer for the direct install URL.**
- Installing from the store gives you **automatic updates**.

### Option B — Download from GitHub (manual)
1. Download/clone this repository
2. Open `edge://extensions` (or `chrome://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the project folder
5. Open the extension **Details** → enable **Allow in InPrivate/Incognito**

> 💡 For enterprise fleets, use the **managed deployment** method (force-install + policy) described below instead of manual install.

---

## 🔤 Rule Formats

| Format | Matches | Use When |
|---|---|---|
| `*.appname.com` | All subdomains (`www.`, `app.`, `login.`, …) | You want broad coverage |
| `www.appname.com` | That exact host only | You need to **exclude** a sibling subdomain |

> ⚠️ **Carve-out caution:** `*.company.com` will also match `okta.company.com`. If you want to target the public site but **not** your Okta tenant, use exact hostnames (e.g., `www.company.com`), not the wildcard.

**Inactivity rules** use the format: `host, minutes`
```
*.appname.com, 5
www.example.com, 2
```

---

## 👤 Personal Setup (Unmanaged)

**No policy or admin rights required.** Anyone can install and configure their own rules.

1. Install via Option A or B above
2. Open the extension's **Options** page
3. **Incognito Rules** — add hostnames to route (one per line)
4. **Tab Inactivity Auto-Close** — add `host, minutes` lines (optional)
5. Check **Close all Incognito windows when the screen locks** (optional)
6. Set **Warn before close (seconds)** (optional; `0` = off)
7. Click **Save**

When no IT policy is present, the extension stores settings locally and the options page is fully editable. If an organization later applies managed policy, those settings take over and the page becomes read-only.

---

## 🛡️ Admin Governance Guide

This section is the **operating manual** for organizations that centrally manage Incognito Router. *(Skip this if you're a personal user.)*

### Governance Principles

1. **Rules are policy, not preference.** When managed, all routing and security settings are pushed via policy (registry/Intune). End users cannot add, edit, or disable them.
2. **Least-scope matching.** Prefer exact hostnames when a parent domain hosts systems you must *not* route (e.g., Okta). Reserve wildcards for domains you fully control.
3. **Inactivity ≠ business apps.** Apply auto-close only to **individual confidential apps** (HR, payroll, admin consoles) — not shared operational dashboards someone monitors passively.
4. **Change control.** Rule changes are made in the policy script, version-controlled, and pushed centrally — never hand-edited on endpoints.
5. **Pilot before fleet.** Validate every rule/timer change on a test group before broad rollout.

### Who Can Change What (Managed Mode)

| Action | Who | How |
|---|---|---|
| Add/remove routed sites | IT / InfoSec admin | Edit `IncognitoRules` in policy script → redeploy |
| Set/adjust inactivity timers | IT / InfoSec admin | Edit `TabInactivityRules` → redeploy |
| Enable/disable screen-lock close | IT / InfoSec admin | Set `CloseIncognitoOnLock` (1/0) |
| Adjust warning lead time | IT / InfoSec admin | Set `WarnBeforeCloseSeconds` |
| Anything | End user | ❌ Not permitted (read-only) |

### Security Notes for Admins

- **Compensating control, not a token killer.** Closing a tab/window ends the *browser* session. If the target app keeps a valid server-side token, true revocation must come from the app or IdP. Document this in your control narrative.
- **Screen-lock close is the strongest shared-workstation control** — it doesn't wait for a timer. Enable it where "clean slate for next user" is the priority.
- **Timer precision is ~±60s** (MV3 alarm cadence). For a hard 5-minute cap, configure 4 minutes.

---

## 🚀 Deployment (Managed / Enterprise)

*Optional — for organizations rolling this out to a fleet. Personal users can ignore this section.*

### Prerequisites
- The extension's **extension ID**
  - If installed from the **Edge store (hidden listing)** → use the permanent store-assigned ID
  - If **loaded from GitHub (unpacked)** → use the local ID shown in `edge://extensions`
- Intune (or GPO) access to push registry policy
- Managed (Intune/Entra) devices

### Two Policy Layers

| Layer | Registry Path | Purpose |
|---|---|---|
| **Managed rules** | `...\3rdparty\extensions\<ID>\policy` | Routing rules, timers, toggles |
| **Extension settings** | `...\ExtensionSettings` | Force-install + Allow in Incognito |

### Deploy Steps
1. Force-install the extension via Intune (Settings Catalog → *Control which extensions are installed silently*)
2. Push the **managed rules** using the setup script below (Intune → Platform Scripts, run as 64-bit)
3. On a test device: `edge://policy` → **Reload policies** → confirm all properties appear
4. Reload the extension → console shows `MANAGED rules: [...] | closeOnLock: true | warn: 40`
5. Confirm the options page shows settings **greyed out / read-only**

---

## 💻 Commands — Admin Setup Script

Use this PowerShell script to configure **routing rules, inactivity timers, the warning banner, and screen-lock behavior** for both Edge and Chrome. **Run as Administrator.**

Replace `<ID>` with your extension ID and edit the values in the **Policy Values** section.

```powershell
# ============================================================
# Incognito Router - Admin Setup Script
# Configures routing rules, inactivity timers, warning banner,
# and screen-lock behavior for Edge + Chrome.
# RUN AS ADMINISTRATOR.
# ============================================================

# ---- Extension ID ----
$extId = "<ID>"   # from edge://extensions (store or unpacked)

# ---- Policy Values (edit these) ----
$incognitoRules = @(
    "*.appname.com",
    "www.example.com"
)

$tabInactivityRules = @(
    @{ host = "*.appname.com";   minutes = 5 },
    @{ host = "www.example.com"; minutes = 2 }
)

$closeIncognitoOnLock   = $true      # $true or $false
$warnBeforeCloseSeconds = 40         # seconds; 0 = off

# ---- Apply to Edge + Chrome ----
$policyPaths = @(
    "HKLM:\Software\Policies\Microsoft\Edge\3rdparty\extensions\$extId\policy",
    "HKLM:\Software\Policies\Google\Chrome\3rdparty\extensions\$extId\policy"
)

foreach ($path in $policyPaths) {
    New-Item -Path $path -Force | Out-Null

    # Arrays -> JSON string
    New-ItemProperty -Path $path -Name "IncognitoRules" `
        -Value ($incognitoRules | ConvertTo-Json -Compress) `
        -PropertyType String -Force | Out-Null

    New-ItemProperty -Path $path -Name "TabInactivityRules" `
        -Value ($tabInactivityRules | ConvertTo-Json -Compress) `
        -PropertyType String -Force | Out-Null

    # Boolean -> DWORD (1/0)
    New-ItemProperty -Path $path -Name "CloseIncognitoOnLock" `
        -Value ([int]$closeIncognitoOnLock) `
        -PropertyType DWord -Force | Out-Null

    # Integer -> DWORD
    New-ItemProperty -Path $path -Name "WarnBeforeCloseSeconds" `
        -Value $warnBeforeCloseSeconds `
        -PropertyType DWord -Force | Out-Null

    Write-Output "Policy applied: $path"
}

Write-Output "Done. Reload policies (edge://policy) and reload the extension."
```

> ⚠️ **Data-type note:** arrays go in as JSON **strings**; the boolean and integer go in as **DWORD**. Writing a boolean as `"true"` (string) will be rejected by schema validation — always use DWORD `1`/`0`.

---

## ✅ Verification Commands

Confirm the policy was applied correctly (**Run as Administrator**):

```powershell
$extId = "<ID>"

# View the applied policy (Edge)
Get-ItemProperty -Path "HKLM:\Software\Policies\Microsoft\Edge\3rdparty\extensions\$extId\policy" |
    Select-Object IncognitoRules, TabInactivityRules, CloseIncognitoOnLock, WarnBeforeCloseSeconds |
    Format-List

# View the applied policy (Chrome)
Get-ItemProperty -Path "HKLM:\Software\Policies\Google\Chrome\3rdparty\extensions\$extId\policy" |
    Select-Object IncognitoRules, TabInactivityRules, CloseIncognitoOnLock, WarnBeforeCloseSeconds |
    Format-List
```

**Remove the policy** (returns the extension to local/editable mode for testing):

```powershell
$extId = "<ID>"
Remove-Item -Path "HKLM:\Software\Policies\Microsoft\Edge\3rdparty\extensions\$extId\policy" -Recurse -Force
Remove-Item -Path "HKLM:\Software\Policies\Google\Chrome\3rdparty\extensions\$extId\policy" -Recurse -Force
```

**In-browser verification:**
1. `edge://policy` (or `chrome://policy`) → **Reload policies** → confirm all 4 properties appear
2. `edge://extensions` → **Reload** the extension
3. Open **Service Worker** console → expect:
   ```
   MANAGED rules: ["*.appname.com", ...] | inactivity: [...] | closeOnLock: true | warn: 40
   ```
4. Open the **Options** page → settings should be **greyed out / read-only**

---

## 📋 Quick Reference Sheet

### Managed Policy Properties

| Property | Type | Example | Notes |
|---|---|---|---|
| `IncognitoRules` | array → JSON string | `["*.appname.com","www.example.com"]` | Hosts routed to Incognito |
| `TabInactivityRules` | array → JSON string | `[{"host":"*.appname.com","minutes":5}]` | Per-tab auto-close |
| `CloseIncognitoOnLock` | boolean → **DWORD 1/0** | `1` | Close all Incognito on lock |
| `WarnBeforeCloseSeconds` | integer → DWORD | `40` | Banner lead time; `0` = off |

### Registry Paths

```
Edge:    HKLM\Software\Policies\Microsoft\Edge\3rdparty\extensions\<ID>\policy
Chrome:  HKLM\Software\Policies\Google\Chrome\3rdparty\extensions\<ID>\policy
```

### In-Browser Checks

| Check | URL |
|---|---|
| Policy loaded | `edge://policy` → Reload policies |
| Extension status / reload | `edge://extensions` |
| Live logs | Extensions → Incognito Router → **Service Worker** |

---

## 🔢 Configuration Data Types

> The #1 deployment gotcha. Each property must be written to the registry in the **correct type**, or strict schema validation silently drops it.

| Schema type | Registry format | PowerShell |
|---|---|---|
| array / object | JSON **String** (REG_SZ) | `ConvertTo-Json -Compress` |
| integer | **DWORD** | `-PropertyType DWord` |
| boolean | **DWORD** (`1`/`0`) | `-Value ([int]$true)` |

**Common failure:** writing a boolean as the string `"true"` → property is rejected → setting appears off. Always use **DWORD 1/0** for booleans.

---

## 🧰 Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Site not routing | Rule format (e.g., `https://` or `/path` included) | Use hostname only: `www.site.com` |
| Wildcard catches too much | `*.company.com` matches all subdomains | Use exact hostname |
| Options page locked unexpectedly | Leftover managed policy in registry | Remove the `\policy` key |
| Checkbox/toggle won't apply | Boolean written as string | Write as **DWORD 1/0** |
| Tab won't close in Incognito | "Allow in Incognito" is OFF | Enable it (or force via policy) |
| No warning banner | Content script not injected | Confirm Allow-in-Incognito + reload |
| Setting shows `LOCAL` not `MANAGED` | Policy not delivered | Restart browser; `edge://policy` → Reload |

---

## 🔒 Privacy

Incognito Router does **not** collect, store, log, or transmit browsing history, personal data, or page content. URL/hostname evaluation happens **locally** on the device to determine routing and inactivity behavior. The inactivity tracker only listens for local activity events (mouse/keyboard/scroll) to reset a timer — it captures no data.

---

## 📜 Version History

| Version | Highlights |
|---|---|
| **v1.2** | Wildcard support (proof of concept) |
| **v2.0** | Reliable routing engine (`tabs.onUpdated`), tab-close fix |
| **v3.0** | Managed storage — IT-controlled, read-only rules |
| **v4.0** | Per-tab inactivity auto-close, warning banner + keep-alive, screen-lock backstop (toggle), full managed policy |

---

*Incognito Router works standalone for individuals and as a centrally-governed control for organizations. For the hidden Edge store install URL, contact the maintainer.*
