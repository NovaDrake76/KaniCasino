// an objectid starts with its creation time in seconds, so a case's age needs no field of its own
const createdAt = (id: string) => (/^[0-9a-f]{24}$/i.test(id) ? parseInt(id.slice(0, 8), 16) * 1000 : NaN);

// how long a case wears the new tag after it is added
export const NEW_FOR_MS = 30 * 24 * 60 * 60 * 1000;

export const isNewCase = (id: string, now = Date.now()) => {
  const at = createdAt(String(id));
  return Number.isFinite(at) && now - at < NEW_FOR_MS;
};
