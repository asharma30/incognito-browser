# 🕵️ Incognito Router

A Microsoft Edge & Google Chrome browser extension that automatically routes designated websites into an **InPrivate/Incognito** session — with optional **per-site inactivity auto-close** for shared and high-sensitivity workstations.

Built for enterprise governance: routing rules and security behavior are **centrally managed by IT policy**, and locked from end-user modification.

---

## 📑 Table of Contents
- [What It Does](#-what-it-does)
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Rule Formats](#-rule-formats)
- [Admin Governance Guide](#-admin-governance-guide)
- [Deployment (Managed)](#-deployment-managed)
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
| **Wildcard + exact matching** | `*.okta.com` or `www.example.com` |
| **Per-tab inactivity auto-close** | Closes a tab after N minutes of no activity (works in Incognito **or** normal tabs) |
| **Inactivity warning banner** | On-page countdown with a **"Keep me signed in"** button |
| **Screen-lock backstop** | *(Admin toggle)* closes all Incognito windows on screen lock |
| **Centralized policy** | All settings managed via IT policy; read-only to users |
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

## 🔤 Rule Formats

| Format | Matches | Use When |
|---|---|---|
| `*.appname.com` | All subdomains (`www.`, `app.`, `login.`, …) | You want broad coverage |
| `www.appname.com` | That exact host only | You need to **exclude** a sibling subdomain |

> ⚠️ **Carve-out caution:** `*.company.com` will also match `okta.company.com`. If you want to target the public site but **not** your Okta tenant, use exact hostnames (e.g., `www.company.com`), not the wildcard.

**Inactivity rules** use the format: `host, minutes`
```
*.okta.com, 5
www.linkedin.com, 2
```

---

## 🛡️ Admin Governance Guide

This section is the **operating manual** for the team that owns Incognito Router.

### Governance Principles

1. **Rules are policy, not preference.** All routing and security settings are pushed via managed policy (registry/Intune). End users cannot add, edit, or disable them.
2. **Least-scope matching.** Prefer exact hostnames when a parent domain hosts systems you must *not* route (e.g., Okta). Reserve wildcards for domains you fully control.
3. **Inactivity ≠ business apps.** Apply auto-close only to **individual confidential apps** (HR, payroll, admin consoles) — not shared operational dashboards someone monitors passively.
4. **Change control.** Rule changes are made in the policy script, version-controlled, and pushed centrally — never hand-edited on endpoints.
5. **Pilot before fleet.** Validate every rule/timer change on a test group before broad rollout.

### Who Can Change What

| Action | Who | How |
|---|---|---|
| Add/remove routed sites | IT / InfoSec admin | Edit `IncognitoRules` in policy script → redeploy |
| Set/adjust inactivity timers | IT / InfoSec admin | Edit `TabInactivityRules` → redeploy |
| Enable/disable screen-lock close | IT / InfoSec admin | Set `CloseIncognitoOnLock` (1/0) |
| Adjust warning lead time | IT / InfoSec admin | Set `WarnBeforeCloseSeconds` |
| Anything | End user | ❌ Not permitted (read-only) |

### Change Workflow

```
1. Edit the policy script (section 2: values)
2. Commit the change to source control (private repo)
3. Push via Intune to a PILOT group
4. Validate: edge://policy → Reload → check extension console
5. Expand to full fleet
```

### Security Notes for Admins

- **Compensating control, not a token killer.** Closing a tab/window ends the *browser* session. If the target app keeps a valid server-side token, true revocation must come from the app or IdP. Document this in your control narrative.
- **Screen-lock close is the strongest shared-workstation control** — it doesn't wait for a timer. Enable it where "clean slate for next user" is the priority.
- **Timer precision is ~±60s** (MV3 alarm cadence). For a hard 5-minute cap, configure 4 minutes.

---

## 🚀 Deployment (Managed)

### Prerequisites
- Extension published (Hidden/unlisted) to the Edge Add-ons store → gives a **permanent extension ID**
- Intune (or GPO) access to push registry policy
- Managed (Intune/Entra) devices

### Two Policy Layers

| Layer | Registry Path | Purpose |
|---|---|---|
| **Managed rules** | `...\3rdparty\extensions\<ID>\policy` | Routing rules, timers, toggles |
| **Extension settings** | `...\ExtensionSettings` | Force-install + Allow in Incognito |

### Deploy Steps
1. Force-install the extension via Intune (Settings Catalog → *Control which extensions are installed silently*)
2. Push the **managed rules** using the policy PowerShell script (Intune → Platform Scripts, run as 64-bit)
3. On a test device: `edge://policy` → **Reload policies** → confirm all properties appear
4. Reload the extension → console shows `MANAGED rules: [...] | closeOnLock: true | warn: 40`
5. Confirm the options page shows settings **greyed out / read-only**

---

## 📋 Quick Reference Sheet

### Managed Policy Properties

| Property | Type | Example | Notes |
|---|---|---|---|
| `IncognitoRules` | array → JSON string | `["*.okta.com","www.linkedin.com"]` | Hosts routed to Incognito |
| `TabInactivityRules` | array → JSON string | `[{"host":"*.okta.com","minutes":5}]` | Per-tab auto-close |
| `CloseIncognitoOnLock` | boolean → **DWORD 1/0** | `1` | Close all Incognito on lock |
| `WarnBeforeCloseSeconds` | integer → DWORD | `40` | Banner lead time; `0` = off |

### Registry Paths

```
Edge:    HKLM\Software\Policies\Microsoft\Edge\3rdparty\extensions\<ID>\policy
Chrome:  HKLM\Software\Policies\Google\Chrome\3rdparty\extensions\<ID>\policy
```

### Verification Commands (PowerShell / Admin)

```powershell
# View applied policy
Get-ItemProperty -Path "HKLM:\Software\Policies\Microsoft\Edge\3rdparty\extensions\<ID>\policy"

# Remove policy (return to local/editable mode for testing)
Remove-Item -Path "HKLM:\Software\Policies\Microsoft\Edge\3rdparty\extensions\<ID>\policy" -Recurse -Force
```

### In-Browser Checks

| Check | URL |
|---|---|
| Policy loaded | `edge://policy` → Reload policies |
| Extension status / reload | `edge://extensions` |
| Live logs | Extensions → Incognito Router → **Service Worker** |

### Expected Console Output
```
MANAGED rules: ["*.okta.com", ...] | inactivity: [...] | closeOnLock: true | warn: 40
```

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
| **v4.0** | Per-tab inactivity auto-close, warning banner + keep-alive, screen-lock backstop (admin toggle), full managed policy |

---

*Incognito Router is an internal security tool. Routing rules and security behavior are governed by Information Security policy.*
