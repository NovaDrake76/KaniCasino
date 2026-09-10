const presence = require("../../utils/presence");

beforeEach(presence.reset);

const socket = (over = {}) => ({
  id: "s1",
  handshake: { headers: {}, address: "127.0.0.1", ...over.handshake },
  ...over,
});

describe("what a socket counts under", () => {
  it("is the account when there is one, whatever address it comes from", () => {
    expect(presence.keyFor(socket({ userId: "u1" }))).toBe("user:u1");
    expect(presence.keyFor(socket({ userId: "u1", handshake: { headers: { "cf-connecting-ip": "1.2.3.4" } } })))
      .toBe("user:u1");
  });

  it("is the address cloudflare saw for a guest, not the tunnel's", () => {
    // every connection reaches the box from localhost, so the socket's own address would
    // fold every guest on the site into one
    expect(presence.keyFor(socket({ handshake: { headers: { "cf-connecting-ip": "1.2.3.4" }, address: "127.0.0.1" } })))
      .toBe("ip:1.2.3.4");
  });

  it("falls back to the socket's address when nothing sits in front", () => {
    expect(presence.keyFor(socket())).toBe("ip:127.0.0.1");
  });
});

describe("counting people rather than sockets", () => {
  it("counts one person with four tabs as one", () => {
    presence.join("user:u1");
    presence.join("user:u1");
    presence.join("user:u1");
    presence.join("user:u1");

    expect(presence.count()).toBe(1);
  });

  it("counts a hundred sockets from one address as one", () => {
    for (let i = 0; i < 100; i++) presence.join("ip:9.9.9.9");

    expect(presence.count()).toBe(1);
  });

  it("keeps a person online until their last tab closes", () => {
    presence.join("user:u1");
    presence.join("user:u1");

    presence.leave("user:u1");
    expect(presence.count()).toBe(1);

    presence.leave("user:u1");
    expect(presence.count()).toBe(0);
  });

  it("says when the number of people changed, so only those changes are broadcast", () => {
    expect(presence.join("user:u1")).toBe(true);
    expect(presence.join("user:u1")).toBe(false);
    expect(presence.leave("user:u1")).toBe(false);
    expect(presence.leave("user:u1")).toBe(true);
  });

  it("never goes negative on a stray disconnect", () => {
    presence.leave("user:ghost");

    expect(presence.count()).toBe(0);
  });

  it("counts different people separately", () => {
    presence.join("user:u1");
    presence.join("user:u2");
    presence.join("ip:1.2.3.4");

    expect(presence.count()).toBe(3);
  });
});
