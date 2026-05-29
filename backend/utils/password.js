const CryptoJS = require("crypto-js");

const decryptWithAES = (ciphertext) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, process.env.PASSWORD_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    return "";
  }
};

// passwords arrive as plain text; legacy clients AES-encrypted them, and that
// output always starts with the base64 of "Salted__", so we can detect and
// decrypt those without ever misreading a plain-text password as ciphertext.
const resolvePassword = (input) => {
  if (typeof input === "string" && input.startsWith("U2FsdGVk")) {
    const decrypted = decryptWithAES(input);
    if (decrypted) return decrypted;
  }
  return input;
};

module.exports = { decryptWithAES, resolvePassword };
