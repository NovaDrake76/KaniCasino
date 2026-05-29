const CryptoJS = require("crypto-js");

describe("password resolution", () => {
  const KEY = "test-password-key";
  let resolvePassword;

  beforeAll(() => {
    process.env.PASSWORD_KEY = KEY;
    ({ resolvePassword } = require("../../utils/password"));
  });

  test("plain-text passwords pass through unchanged", () => {
    expect(resolvePassword("hunter2")).toBe("hunter2");
    expect(resolvePassword("p@ssw0rd-with-symbols!")).toBe("p@ssw0rd-with-symbols!");
  });

  test("legacy AES-wrapped passwords are decrypted", () => {
    const cipher = CryptoJS.AES.encrypt("my real password", KEY).toString();
    expect(cipher.startsWith("U2FsdGVk")).toBe(true); // sanity: salted prefix
    expect(resolvePassword(cipher)).toBe("my real password");
  });

  test("a plain-text password that resembles ciphertext is still preserved when it can't decrypt", () => {
    // not valid CryptoJS ciphertext for this key -> returns input unchanged
    expect(resolvePassword("not-a-real-cipher")).toBe("not-a-real-cipher");
  });
});
