// Saving: one localStorage slot for money, mission progress and packages. Every
// call is guarded — a headless screenshot run has no storage, and the game must
// not care.
const KEY = 'neon-bay-nights-save-v1';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      mission: state.story.index,
      packages: state.packagesFound,
      best: Math.max(state.best || 0, state.money),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (err) {
    /* storage is optional */
  }
}
