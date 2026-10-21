// a device's clock can be minutes or hours off the server's, and the pot fills on the server's: a phone set
// behind saw an empty jar it could not take from. what the server last said the time was keeps the two together
let skewMs = 0;

// how far this device runs ahead of the server, from a timestamp the server has just sent
export const noteServerTime = (iso?: string | null) => {
  const at = iso ? Date.parse(iso) : NaN;
  if (Number.isFinite(at)) skewMs = Date.now() - at;
};

// the server's time now, as near as this device can tell
export const serverNow = () => Date.now() - skewMs;

export const resetServerClock = () => {
  skewMs = 0;
};
