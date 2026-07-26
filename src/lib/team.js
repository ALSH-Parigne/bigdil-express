const STORAGE_KEY = 'chasse-tresor-team'

export function getStoredTeam() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredTeam(team) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(team))
}

export function clearStoredTeam() {
  localStorage.removeItem(STORAGE_KEY)
}
