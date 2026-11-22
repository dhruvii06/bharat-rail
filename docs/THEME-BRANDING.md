# Light and dark themes — Bharat Rail ITSM

Both themes use the **same logo**: the light-mode logo supplied by the team. The dark-theme copy is the same artwork recoloured by `scripts/recolor-logo.py`. The navy text, train and grey tagline become light; the orange and green stay unchanged. Both files have transparent backgrounds, so they sit cleanly on any surface.

| Background | Asset |
|---|---|
| Light (light mode: sign-in page and light-teal top bar) | `public/brand/bharat-rail-light.webp` |
| Dark (dark mode: sign-in page and deep-teal top bar) | `public/brand/bharat-rail-dark.webp` |

To regenerate the dark copy after the logo changes (needs Python with Pillow):

```bash
python scripts/recolor-logo.py <original-light-logo> public/brand/bharat-rail-light.webp public/brand/bharat-rail-dark.webp
```

## Behaviour

- Theme toggle in the header for all signed-in roles and on the login/registration page.
- Default to the browser's operating-system preference when no prior choice is saved.
- A deliberate choice overrides OS preference and persists under localStorage key `bharat-rail.theme`.
- The top bar is teal, the opposite of the logo's orange so "ITSM" stands out: light teal `#cdeaea` in light mode and deep teal `#0b3b40` in dark mode. Its text and buttons use the `--br-header-*` tokens.
- The logo changes instantly on toggle on the login page and inside the application.
- Shared `src/theme.tsx` state updates `document.documentElement.dataset.theme`. CSS overrides live in `src/theme.css` to avoid rewriting the existing team stylesheet.
- The theme changes dashboard cards, forms, tables, navigation, notification menus, administrator pages, severity labels, and the impact simulator.
- Accessible text/icon toggle with `aria-label`, keyboard access, visible focus and responsive layout.
- The page applies the saved theme in `index.html` before React mounts to prevent a bright flash for dark-mode users.

## Test commands

```bash
npm ci
npm test
npm run build
```

`tests/theme.test.mjs` tests saved-theme precedence, OS fallback, switch reversibility and both image asset signatures. Recommended manual acceptance checks:

1. Load sign-in without a saved preference when OS is dark and when OS is light.
2. Toggle on sign-in, sign in, and verify the chosen mode persists.
3. Refresh and navigate between dashboard, incident detail, admin and simulator.
4. Test narrow screens and keyboard-only use of the switch.
5. Compare the light logo with the uploaded original, and check that the dark copy matches it apart from colour.
6. In a private/incognito browser with blocked storage, ensure toggle still works for the current session.

## Scope

No changes were made to authorization, incident rules, Java domain logic, database schema, or API behaviour. This PR is only for UI branding/theme and must be reviewed before merging into `main`.
