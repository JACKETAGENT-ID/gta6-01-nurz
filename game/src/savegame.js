// Save game v3: Neon Bay Nights keeps money, mission progress, earned
// cash, collected packages and the radio station in localStorage.
// Nothing leaves the browser. A save from an older version loads fine —
// missing fields just fall back to their defaults.

const KEY = 'neon-bay-nights-save-v3';

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: state.money,
      missionIdx: state.missionIdx,
      earned: state.earned,
      packagesTaken: state.packagesTaken || 0,
      radioStation: state.radioStation || 0,
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
    if (typeof data.packagesTaken !== 'number') data.packagesTaken = 0;
    if (typeof data.radioStation !== 'number') data.radioStation = 0;
    return data;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
