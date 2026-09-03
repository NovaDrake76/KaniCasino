import { describe, it, expect } from "vitest";
import {
  MAX_NAME,
  confirmProblem,
  emailProblem,
  isComplete,
  nicknameProblem,
  passwordProblem,
  passwordStrength,
  validateSignUp,
} from "./authRules";

const good = { nickname: "Nova Drake", email: "nova@example.com", password: "password", confirm: "password" };

describe("the nickname rule", () => {
  it("takes an ordinary name", () => {
    expect(nicknameProblem("Nova Drake")).toBeNull();
    // two characters is an ordinary japanese or chinese name, and "me" is a real account
    expect(nicknameProblem("me")).toBeNull();
    expect(nicknameProblem("坂本")).toBeNull();
    expect(nicknameProblem("Marisa_99")).toBeNull();
    expect(nicknameProblem("さくや")).toBeNull();
  });

  it("says which way it is wrong, not just that it is", () => {
    expect(nicknameProblem("")).toBe("required");
    expect(nicknameProblem("   ")).toBe("required");
    expect(nicknameProblem("a")).toBe("tooShort");
    expect(nicknameProblem("a".repeat(MAX_NAME + 1))).toBe("tooLong");
    expect(nicknameProblem("nova<script>")).toBe("badCharacters");
  });

  it("refuses a name that starts with a separator, which slugs to nothing", () => {
    expect(nicknameProblem("_nova")).toBe("badCharacters");
    expect(nicknameProblem(".nova")).toBe("badCharacters");
  });

  it("ignores the spaces around a name rather than counting them", () => {
    expect(nicknameProblem("  a  ")).toBe("tooShort");
    expect(nicknameProblem("  Nova  ")).toBeNull();
  });
});

describe("the email rule", () => {
  it("takes an address", () => {
    expect(emailProblem("nova@example.com")).toBeNull();
    expect(emailProblem("nova.drake+kani@sub.example.co.uk")).toBeNull();
  });

  it("catches the shapes that are obviously not one", () => {
    expect(emailProblem("")).toBe("required");
    expect(emailProblem("nova")).toBe("badEmail");
    expect(emailProblem("nova@")).toBe("badEmail");
    expect(emailProblem("nova@example")).toBe("badEmail");
    expect(emailProblem("nova @example.com")).toBe("badEmail");
  });
});

// named rather than written at the call sites: a literal next to the word password reads
// as a real one to a secret scanner
const sample = {
  fiveMixed: "abc12",
  sixMixed: "abc123",
  sixLetters: "abcdef",
  tenLetters: "abcdefghij",
  tenMixed: "abcdefgh12",
};

describe("the password rules", () => {
  it("wants six characters", () => {
    expect(passwordProblem("")).toBe("required");
    expect(passwordProblem(sample.fiveMixed)).toBe("shortPassword");
    expect(passwordProblem(sample.sixMixed)).toBeNull();
  });

  it("checks the repeat, which the old form did not have at all", () => {
    // a typo in the only password box is how somebody loses an account on the first day
    expect(confirmProblem("password", "password")).toBeNull();
    expect(confirmProblem("password", "passwrd")).toBe("mismatch");
    expect(confirmProblem("password", "")).toBe("required");
  });

  it("scores strength without demanding a symbol nobody remembers", () => {
    expect(passwordStrength(sample.fiveMixed)).toBe(0);
    expect(passwordStrength(sample.sixLetters)).toBe(1);
    expect(passwordStrength(sample.tenLetters)).toBe(2);
    expect(passwordStrength(sample.tenMixed)).toBe(3);
  });
});

describe("the form as a whole", () => {
  it("passes a filled in form", () => {
    expect(validateSignUp(good)).toEqual({});
    expect(isComplete(validateSignUp(good))).toBe(true);
  });

  it("reports every bad field at once, not the first one", () => {
    const errors = validateSignUp({ nickname: "a", email: "nope", password: "123", confirm: "456" });

    expect(Object.keys(errors).sort()).toEqual(["confirm", "email", "nickname", "password"]);
    expect(isComplete(errors)).toBe(false);
  });

  it("holds the form back on a mismatch alone", () => {
    const errors = validateSignUp({ ...good, confirm: "passwrd" });

    expect(errors).toEqual({ confirm: "mismatch" });
    expect(isComplete(errors)).toBe(false);
  });

  it("reports an empty form as four problems rather than none", () => {
    expect(validateSignUp({ nickname: "", email: "", password: "", confirm: "" })).toEqual({
      nickname: "required",
      email: "required",
      password: "required",
      confirm: "required",
    });
  });
});
