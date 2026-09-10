// who is online, counted as people rather than sockets. every open tab is its own socket,
// so a player with the site in four tabs used to show as four, and a script opening a
// hundred connections could put a hundred on the counter. an account is one presence
// however many sockets it holds; a guest is one presence per address.
const sockets = new Map();

// the key a socket counts under. cf-connecting-ip is the address cloudflare saw, which
// is why the http rate limiters trust it and not x-forwarded-for.
function keyFor(socket) {
  if (socket.userId) return `user:${socket.userId}`;
  const headers = (socket.handshake && socket.handshake.headers) || {};
  const address = headers["cf-connecting-ip"] || (socket.handshake && socket.handshake.address) || socket.id;
  return `ip:${address}`;
}

// true when the count of people changed, which is the only time it is worth broadcasting
function join(key) {
  const n = (sockets.get(key) || 0) + 1;
  sockets.set(key, n);
  return n === 1;
}

function leave(key) {
  const n = (sockets.get(key) || 0) - 1;
  if (n <= 0) sockets.delete(key);
  else sockets.set(key, n);
  return n <= 0;
}

const count = () => sockets.size;

// for tests, which share one module instance
const reset = () => sockets.clear();

module.exports = { keyFor, join, leave, count, reset };
