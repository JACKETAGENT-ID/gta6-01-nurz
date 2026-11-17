// Save game: Neon Bay Nights keeps money, mission progress and totals in
// localStorage. Nothing leaves the browser.

const KEY = 'neon-bay-nights-save-v2';

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: state.money,
      missionIdx: state.missionIdx,
      earned: state.earned,
      savedAt: Date.now(),
    }));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIdx !== 'number') return null;
    return data;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
