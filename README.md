# Incognito Router

A browser extension for Microsoft Edge and Google Chrome that automatically opens configured websites in an Incognito/InPrivate browser window.

## Features

- Exact hostname matching
- Wildcard matching (*.domain.com)
- Configurable rules
- Automatic InPrivate launch
- Automatic closure of the original tab
- Loop prevention
- Hostname cooldown protection
- Edge and Chrome support

## Example Rules

```text
*.okta.com
google.com
```

## Known Issues

- Google routing is inconsistent
- Some SSO providers may open both browser and Incognito windows
- Duplicate Incognito windows may occur during redirect chains
 

These issues will be addressed in v2.0.