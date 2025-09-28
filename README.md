# Bedroom Monster (Proto)
Top-down survival prototype built with Phaser + TypeScript. **GitHub-only workflow**: CI builds and deploys to GitHub Pages on every push to `main`.

## Play it
Enable GitHub Pages → Source: **GitHub Actions**. The Actions workflow in `.github/workflows/deploy.yml` deploys `dist/`.

## Scripts
- Requires **Node.js ≥18**.
- `npm run dev` – local dev (optional if using Codespaces)
- `npm run build` – build to `dist/`
- `npm run preview` – serve the build locally

> ℹ️ **Do not open `index.html` directly in the browser.** Browsers cannot execute the TypeScript entry (`src/main.ts`) referenced by the page, so nothing will render.
> Always run through Vite via `npm run dev` (or `npm run build`/`npm run preview`) so the TypeScript is compiled before loading.

## Controls
- Move: Arrow keys
- Interact: `E` (pickup/swap), `G` (drop slot 1)
- Use: `1` (slot 1), `2` (slot 2)
- Craft: `R` (combine slots → result in slot 1)

## Design targets
- Player HP **5**, Monster HP **12**
- Two-slot inventory; base items & a few recipes
- Monster chase with simple periodic actions

## Roadmap
See Issues and Milestones.
