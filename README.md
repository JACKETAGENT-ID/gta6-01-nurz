[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/JACKETAGENT-ID/gta6-01-nurz/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/JACKETAGENT-ID/gta6-01-nurz/reward.svg)](https://make.fun/c/gta6-01)

# Neon Bay Nights

An original open-world crime game for the make.fun **gta6-01** bounty — a
fictional neon city, built in vanilla JavaScript with no libraries, no
downloads and no network requests. Every name, character, place, story beat
and sound is our own; nothing comes from Rockstar Games or any other
commercial game.

## The game

You are **Raka**, a courier for **Madame Lumen**, who runs the Neon Bay night
scene. Four story missions take you across the city:

1. **Neon Package** — pick up a glowing case at the Old Docks warehouse and
   deliver it to Lumen's Lounge downtown.
2. **Harbor Heist** — steal a cargo crate from the container yard and stash
   it at the hideout while the harbour patrol closes in.
3. **Chase the Shadow** — tail a grey shadow car without spooking it, then
   cut it off at the north plaza.
4. **The Big Escape** — outrun a four-star police response, roadblocks and
   all, to the boat on Coral Beach.

Between missions the city is yours: steal cars and motorbikes, take taxi
side-jobs (press **T**), and watch the wanted heat rise — and slowly cool
off — as the Neon Bay police chase, ram and set roadblocks. Day turns to
night on a five-minute cycle; at night the neon signs glow and your
headlights cut the dark.

## Controls

- **WASD / arrows** — walk or drive (Shift to run)
- **Mouse** — aim · **Click** — shoot · **F** — punch · **R** — reload
- **E** — steal / enter / exit a car or motorbike · **Space** — handbrake
- **T** — taxi side-job · **P** — pause · **M** — mute

Progress (cash and mission) saves to localStorage automatically.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Screenshots

The game supports deterministic staging for screenshots:
`?shot=start|play|chase|mission&seed=1` — see `shots.json`.

## Structure

- `game/index.html` — canvas page, loads `src/boot.js`
- `game/src/boot.js` — entry point, reads `?shot=` / `?seed=`
- `game/src/engine.js` — game state, main loop, camera, rendering glue
- `game/src/citymap.js` — Neon Bay: Downtown, Old Docks, Coral Beach
- `game/src/vehicles.js` — cars, motorbikes, traffic AI, stealing, driving
- `game/src/walkers.js` — pedestrians
- `game/src/police.js` — wanted heat, patrol cars, roadblocks
- `game/src/combat.js` — fists, pistol, reload, bullets, particles
- `game/src/story.js` — four missions and the taxi side-job
- `game/src/daynight.js` — day/night cycle and headlights
- `game/src/audio.js` — synthesised WebAudio sound and music
- `game/src/hud.js` — HUD, minimap, objective arrow, menus
- `game/src/savegame.js` — localStorage saves
- `game/src/controls.js` — keyboard and mouse input
- `game/src/shots.js` — deterministic screenshot staging
- `game/src/rng.js` — seeded random numbers
- `main.ts` — entry program: copies the game and screenshots to `/output`
  and writes `dossier.json` with the vendored make.fun library

## License

MIT — see `LICENSE`.
