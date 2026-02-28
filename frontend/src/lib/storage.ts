import type { Session } from "../types";

const STORAGE_KEY = "chaoscontext_sessions";

export function saveSessions(sessions: Session[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error("Failed to save sessions to localStorage:", err);
  }
}

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Session[];
  } catch (err) {
    console.error("Failed to load sessions from localStorage:", err);
    return [];
  }
}
