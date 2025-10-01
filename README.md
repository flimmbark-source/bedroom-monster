# Bedroom Monster (Proto)
Top-down survival prototype built with Phaser + TypeScript. **GitHub-only workflow**: CI builds and deploys to GitHub Pages on every push to `main`.

## Current status
- **Playable dorm-room encounter.** A single `PlayScene` sets up the bedroom, populates furniture hitboxes, spawns the player with WASD + mouse controls, and brings in the monster with full collision + telegraphed overlap handling. Starter loot is seeded on the floor and a timed restock loop keeps supplies coming. 
- **Search → loot loop.** Pushable/searchable furniture highlights when approached, kicks off a timed search minigame with checkpoint loot rolls, and awards items directly into the two-slot inventory while a HUD search bar tracks progress. Searches end early if the bag fills.
- **Combat + item verbs.** Each inventory item has a concrete combat effect—knife arcs, yoyo rings, bottle throws, buffs, etc.—and consumption updates the HUD. Crafting combines the two slots into upgraded recipes like fire bottles or adrenal patches.
- **Telegraphed monster AI.** The monster class manages attack priorities, rage scaling, hitboxes, and telegraph shapes that damage, slow, or knock back the player when collisions resolve.
- **UI polish.** The HUD renders hearts, item slots with use pips, and an always-visible control reference for the current bindings.

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
- Move: WASD (mouse aim)
- Interact: `E` (pickup/search), `G` (drop active slot)
- Use: Left Click (slot 1), Right Click (slot 2)
- Craft: `R` (combine slots → result in slot 1)

## Roadmap
See Issues and Milestones for upcoming beats.
