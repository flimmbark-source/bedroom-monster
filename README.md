# Bedroom Monster (Proto)

A top-down dorm-survival prototype built with Phaser + TypeScript. The playable build lives in a single `PlayScene` that lays out the room, seeds loot, drives the monster encounter, and renders the HUD. Every push to `main` is built by GitHub Actions and deployed to GitHub Pages.

---

## Quick start

- Requires **Node.js ≥18**.
- `npm install`
- `npm run dev` – local development server
- `npm run build` – production build to `dist/`
- `npm run preview` – preview the production build locally

> ℹ️ **Do not open `index.html` directly in the browser.** Browsers cannot execute the TypeScript entry (`src/main.ts`) referenced by the page, so nothing will render. Always use the Vite scripts above so the TypeScript compiles before loading.

---

## Gameplay overview

1. **Gear up.** Search the suite, grab starter loot, and restock from supply drops that periodically spawn on the floor.
2. **Manage the bag.** Two inventory slots hold anything you pick up. Items can be used directly or combined into higher-tier recipes.
3. **Survive the monster.** Dodge attack telegraphs, leverage consumables, and exploit rage windows while keeping your health hearts filled.

The goal is to survive as long as possible against the escalating monster while keeping the dorm supplied.

---

## Systems & features

### Room layout & interaction space
- `PlayScene` defines the 1280×720 room bounds and populates furniture sprites + physics blockers so the player and monster share tight navigation lanes.
- Every searchable prop stores metadata (name, search time, checkpoints, loot table, emoji label) so interactions feel bespoke even though they share code paths.

### Search → loot loop
- Furniture search kicks off a timed progress bar with mid-search loot rolls; checkpoints award items immediately if inventory space exists.
- Highlight outlines, emoji callouts, and label offsets help communicate which piece you are working on.

### Inventory, items, and verbs
- Two-slot inventory lives on the player entity and is mirrored in the HUD; picking up items auto-sorts into the first open slot.
- `BASE_ITEMS` defines all usable verbs (knife arcs, bottles, soda buffs, etc.) with icon bindings for the HUD.
- Item consumption mutates the slot, decrements uses, and triggers bespoke effects like heals, speed boosts, thrown projectiles, or on-hit DOTs.

### Crafting recipes
- Combining the two inventory slots via `R` runs the crafting table and replaces slot 1 with the recipe output on success.
- Recipes cover offensive upgrades (fire bottles, bladed yoyos) and utility (adrenal/smoke patches) to keep the loop evolving.

### Monster AI & telegraphs
- The monster sprite manages its own HP, rage state, attack cooldowns, and animation facing while roaming toward the player.
- Each attack spins up a multi-phase telegraph (pre-warn, wind-up, commit, recovery) with geometry queries to register player hits, knockback, slows, or screen shake.
- Rage mode accelerates timings and movement, updating the HP bar overlay and pushing the player to adapt mid-fight.

### Player status & combat resolution
- Player stats (HP, i-frames, slows, knockback, temporary speed buffs) are tracked on the scene and updated each tick based on collisions and item usage.
- Monster hitboxes call into shared damage handlers that respect invulnerability windows and feed the HUD heart renderer.

### Restock loop & drops
- Ground restock points periodically spawn random gear from the shared pool whenever fewer than four loose items remain in the room.
- Items can also be tossed back to the floor, where they persist as labeled sprites and can be reclaimed later.

### HUD & player-facing feedback
- `ui/hud.ts` builds a fixed-depth overlay with hearts, slot labels, remaining-use pips, and an always-on control reference.
- `drawHUD` syncs the UI each frame to reflect HP changes, inventory swaps, and remaining uses per slot.

---

## Content reference

- **Items:** Defined in `src/game/items.ts` with icon keys, labels, default uses, and per-item data payloads.
- **Recipes:** Declared in `src/game/recipes.ts` and consumed via the crafting helper.
- **Monster:** Implemented in `src/game/monster.ts`, exposing attack telegraph hooks and rage behavior used by the scene.
- **Assets:** Sprite sheets and atlases live under `public/assets/sprites/` and are loaded in `PlayScene.preload`.

---

## Project structure

```
src/
  main.ts          # Bootstraps Phaser
  scenes/PlayScene # Core gameplay loop (room, player, monster, loot)
  game/            # Config, item data, monster class, crafting recipes
  ui/hud.ts        # HUD creation + rendering helpers
public/assets/     # Background, furniture, character, and item art
```

---

## Controls

| Action            | Input           |
| ----------------- | --------------- |
| Move              | WASD (mouse aim) |
| Use item slot 1   | Left mouse       |
| Use item slot 2   | Right mouse      |
| Interact / Search | `E`              |
| Drop item         | `G`              |
| Craft combine     | `R`              |

---

## Deployment

Enable GitHub Pages → Source: **GitHub Actions**. The workflow in `.github/workflows/deploy.yml` builds and deploys the latest `dist/` output on every push to `main`.

