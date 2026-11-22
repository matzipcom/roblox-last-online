const ACTIVE = new Set(['online', 'in-game', 'studio'])

export const isActive = (status) => ACTIVE.has(status)
