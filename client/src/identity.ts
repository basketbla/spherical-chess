// A stable, client-generated player identity, persisted in localStorage so a
// player keeps their seat across reloads and reconnects. NOTE: this is identity,
// not authentication — it's trivially spoofable and will be replaced by real
// accounts/auth later. See docs/architecture.md (Online Multiplayer limitations).
const PLAYER_ID_KEY = 'spherical-chess-player-id';

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getPlayerId(): string {
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private mode, etc.) — ephemeral id for this tab.
    return randomId();
  }
}
