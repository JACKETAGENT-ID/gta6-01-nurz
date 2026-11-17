# Neon Bay Nights

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/JACKETAGENT-ID/gta6-01-nurz/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/JACKETAGENT-ID/gta6-01-nurz/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the [gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01). Explore the fictional city of **Neon Bay** — Downtown, the Old Docks harbor and Coral Beach — on foot and by car, as **Raka**, a driver running jobs for the fixer **Madame Lumen**.

## The game

- **6 story missions** ($7,200 in rewards): Neon Package, Harbor Heist, Chase the Shadow, The Big Escape, Rainy Getaway (a night chase in the rain) and The Vault (crack Neon Bay Bank while holding the vault ring at wanted 4).
- **A living city**: traffic that drives the road grid, five kinds of pedestrians (with umbrellas when it rains), a day/night cycle with headlights, and rain fronts that make the roads slick.
- **Wanted 0–5 and the police**: cruisers that chase and ram, roadblocks at wanted 3, and an Interceptor that joins at wanted 4. Heat cools off when you stay clean — get caught on foot and you are Busted.
- **Cars to steal**: sedans, taxis, sports cars, vans, buses and a motorbike — each with its own handling. E steals the nearest car.
- **Combat**: fists (F) and a pistol (mouse + click) with tracers and reloads.
- **Side jobs**: drive a taxi (T) for fares, and hunt 20 hidden neon packages (◆) across the city.
- **Radio**: three invented stations — NEON FM 101.1, BAY BEATS 88.5, HARBOR JAZZ 95.7 — synthesized live in WebAudio. R changes station in a car.
- **HUD with minimap**, objective arrow, wanted stars, vault progress bar and a save that persists in localStorage.

## Controls

WASD / arrows — move & drive · E — steal / exit car · Mouse + click — shoot · F — punch · T — taxi job · R — radio station · V — radio on/off · P — pause · M — mute · Enter — start

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop Chrome. No network requests, no build step — every file the game loads lives under `game/`.

## Tech

Vanilla JavaScript ES modules, Canvas 2D, WebAudio synthesis. No libraries, no assets downloaded. The entry program `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

MIT licensed.
