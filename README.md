[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/JACKETAGENT-ID/gta6-01-nurz/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/JACKETAGENT-ID/gta6-01-nurz/reward.svg)](https://make.fun/c/gta6-01)

# Neon Bay Nights

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/c/gta6-01). You are **Raka**, a
courier for **Madame Lumen**, fixer of the fictional neon city of **Neon Bay**.
Steal cars, outrun the Neon Bay Police, and finish three story jobs to own
the night. Everything — the city, the characters, the story, the art and the
sounds — is invented here. No Rockstar / GTA names, art, music or maps.

## The game

- **A city to explore** on foot and by car: a 13×13-block neon grid with
  traffic, pedestrians, parks, cash pickups and a safehouse.
- **Cars to steal and drive**: press E next to any street car. Stealing one
  raises your wanted level.
- **Wanted level + police**: 5 stars of heat. Patrol cars chase, ram and try
  to bust you on foot. Lie low and the heat cools off.
- **Missions + story**: three jobs in a row — *Neon Package* (pick up and
  deliver), *Chase the Shadow* (tail the orange coupe), *The Big Escape*
  (survive 45 seconds at 3 stars, then reach the safehouse).
- **Combat**: punch (F) and a pistol (mouse / Space, R to reload).
- **HUD + minimap**, start screen, pause, game over / busted / story-complete
  screens, and autosave to localStorage after every finished job.
- **Sound**: everything is synthesised live with WebAudio — engine hum,
  two-tone sirens, gunshots, jingles. No audio files.
- **Controls**: WASD / arrows to move and drive, E enter/steal a car,
  F punch, mouse / Space shoot, R reload, P pause, M mute.

## How to run it

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

No build step, no network request: `game/` is plain static files.

## Screenshots

The four images in `screenshots/` are real renders of the game, staged
deterministically with `?shot=start|play|chase|mission&seed=1` (see
`shots.json` and `game/src/shots.js`). The first, `1-chase.jpg`, is the cover:
a police chase with the wanted level, the minimap and a mission objective
on the HUD.

## Layout

- `game/index.html` — the page; `game/src/` — the source, one clear job per
  file (`city.js`, `traffic.js`, `police.js`, `missions.js`, `combat.js`,
  `hud.js`, `audio.js`, `input.js`, `save.js`, `shots.js`, `main.js`).
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output`
  and writes `dossier.json` with the vendored make.fun library.
- `vendor/makefun-game.ts` — the kit's library, unchanged.

## License

MIT — see [LICENSE](LICENSE).
