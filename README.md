[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/JACKETAGENT-ID/gta6-01-nurz/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/JACKETAGENT-ID/gta6-01-nurz/reward.svg)](https://make.fun/c/gta6-01)

# Neon Bay Nights

An original open-world crime game for the make.fun **gta6-01** bounty — a
fictional neon city, built in vanilla JavaScript with no libraries, no
downloads and no network requests. Every name, character, place, story beat
and sound is our own; nothing comes from Rockstar Games or any other
commercial game. See the bounty page:
https://make.fun/bounty/gta6-01

## The game

You are **Raka**, a courier for **Madame Lumen**, who runs the Neon Bay night
scene. Six story missions take you across the city:

1. **Neon Package** — pick up a glowing case at the Old Docks warehouse and
   deliver it to Lumen's Lounge downtown.
2. **Harbor Heist** — steal a cargo crate from the container yard and stash
   it at the hideout while the harbour patrol closes in.
3. **Chase the Shadow** — tail a grey shadow car without spooking it, then
   cut it off at the north plaza.
4. **The Big Escape** — outrun a four-star police response, roadblocks and
   all, to the boat on Coral Beach.
5. **Rainy Getaway** — meet Lumen's fixer in a rainy alley, then shake the
   tail at Crescent Market while the rain slicks the roads.
6. **The Vault** — crack the Neon Bay Bank vault: hold the ring while the
   drill works under a four-star response, then run for the hideout.

Between missions the city is yours: steal cars, vans, a city bus and
motorbikes, take taxi side-jobs (press **T**, with a tip if you hurry), hunt
the twenty glowing neon packages hidden around the map, and watch the wanted
heat rise — and slowly cool off — as the Neon Bay police chase, ram, set
roadblocks and send an interceptor after you. Day turns to night on a
five-minute cycle; rain fronts drift in and out, the neon signs glow at
night, and your headlights cut the dark. Three radio stations
(**NEON FM 101.1**, **BAY BEATS 88.5**, **HARBOR JAZZ 95.7**) play
synthesised music — switch with **R** while driving or **V** anywhere.

## Controls

- **WASD / arrows** — walk or drive (Shift to run, Space handbrake)
- **Mouse** — aim · **Click** — shoot · **F** — punch · **R** — reload
  (radio while driving)
- **E** — steal / enter / exit a car, van, bus or motorbike
- **T** — taxi side-job · **V** — change radio station · **P** — pause
- **M** — mute

Progress (cash, mission, packages, radio station) saves to localStorage
automatically.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Screenshots

The game supports deterministic staging for screenshots — open the game
with `?shot=start|play|chase|mission&seed=1`:

- `start` — title menu over downtown
- `play` — Raka on foot downtown
- `chase` — Rainy Getaway: night rain, sports car, four patrol cars
- `mission` — The Vault: morning at the bank, drill running, wanted 4

## Structure

- `game/index.html` — canvas page, loads `src/boot.js`
- `game/src/boot.js` — entry point, reads `?shot=` / `?seed=`
- `game/src/engine.js` — game state, main loop, camera, rendering glue
- `game/src/citymap.js` — Neon Bay: Downtown, Old Docks, Coral Beach,
  Crescent Market, the Neon Bay Bank
- `game/src/vehicles.js` — cars, van, bus, motorbikes, traffic AI, stealing
- `game/src/walkers.js` — pedestrians (tourists, suits, joggers,
  dockworkers) with umbrellas in the rain
- `game/src/police.js` — wanted heat, patrol cars, interceptor, roadblocks
- `game/src/combat.js` — fists, pistol, reload, bullets, particles, smoke
- `game/src/story.js` — six missions and the taxi side-job
- `game/src/daynight.js` — day/night cycle, stars, moon, headlights
- `game/src/weather.js` — rain fronts, wet roads, screen rain
- `game/src/radio.js` — three synthesised radio stations
- `game/src/collectibles.js` — twenty neon packages to hunt
- `game/src/audio.js` — synthesised WebAudio sound, music and rain
- `game/src/hud.js` — HUD, minimap, objective arrow, menus
- `game/src/savegame.js` — localStorage saves
- `game/src/controls.js` — keyboard and mouse input
- `game/src/shots.js` — deterministic screenshot staging
- `game/src/rng.js` — seeded random numbers
- `main.ts` — entry program: copies the game and screenshots to `/output`
  and writes `dossier.json` with the vendored make.fun library

## License

MIT — see `LICENSE`.
