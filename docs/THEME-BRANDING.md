# Light and dark themes — Bharat Rail ITSM

This feature uses the **two logos supplied by the project team**, not newly generated artwork. The images are cropped and compressed into compact WebP files for web use, retaining the train illustration, shading, colours, name and **For Every Journey** tagline.

| Theme | Asset |
|---|---|
| Light | `public/brand/bharat-rail-light.webp` |
| Dark | `public/brand/bharat-rail-dark.webp` |

## Behaviour

- Theme toggle in the header for all signed-in roles and on the login/registration page.
- Default to the browser's operating-system preference when no prior choice is saved.
- A deliberate choice overrides OS preference and persists under localStorage key `bharat-rail.theme`.
- The selected logo changes instantly on toggle on the login page and inside the application.
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
5. Compare both logos to the uploaded originals, especially train shading and tagline.
6. In a private/incognito browser with blocked storage, ensure toggle still works for the current session.

## Scope

No changes were made to authorization, incident rules, Java domain logic, database schema, or API behaviour. This PR is only for UI branding/theme and must be reviewed before merging into `main`.
