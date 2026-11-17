// save.js — localStorage save: cash, mission progress, best run. Nothing leaves
// the browser; the save is how the start screen offers Continue.
const KEY = 'neon-bay-nights-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 120,
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      completed: data.completed === true,
      bestCash: typeof data.bestCash === 'number' ? data.bestCash : 0,
    };
  } catch (e) {
    return null;
  }
}

export function writeSave(game) {
  try {
    const bestCash = Math.max(game.bestCash || 0, game.cash);
    game.bestCash = bestCash;
    localStorage.setItem(KEY, JSON.stringify({
      cash: game.cash,
      missionIndex: game.missions.index,
      completed: game.missions.completed,
      bestCash,
    }));
  } catch (e) {
    // Storage full or blocked: the game keeps running without a save.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    // Ignore.
  }
}
