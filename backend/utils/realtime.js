// the one socket.io server, handed over once at boot. the routers that are factories take
// io as an argument; this is for the ones that are not and still have to reach it.
let io = null;

const setIo = (instance) => {
  io = instance;
};

const getIo = () => io;

// hang up every live socket belonging to one account. revoking a token only stops the
// next handshake, and a socket that stays connected would keep its identity for good.
function disconnectUser(userId) {
  if (!io || !userId) return;
  io.in(String(userId)).disconnectSockets(true);
}

module.exports = { setIo, getIo, disconnectUser };
