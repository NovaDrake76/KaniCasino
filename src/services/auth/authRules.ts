// the same rules the server enforces, run as you type so a mistake is caught in the field
// that caused it rather than as one red line under the whole form after a round trip.
// backend/utils/signup.js is the authority; these mirror it and must not drift.
export const MIN_NAME = 2;
export const MAX_NAME = 30;
export const MIN_PASSWORD = 6;

const NAME_SHAPE = /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u;
// deliberately loose: the server and the mail provider are the real check, and a clever
// pattern here only ever rejects somebody's perfectly good address
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// every rule returns a translation key or null. null means the field is fine.
export const nicknameProblem = (raw: string): string | null => {
  const name = raw.trim();
  if (!name) return "required";
  if (name.length < MIN_NAME) return "tooShort";
  if (name.length > MAX_NAME) return "tooLong";
  if (!NAME_SHAPE.test(name)) return "badCharacters";
  return null;
};

export const emailProblem = (raw: string): string | null => {
  const email = raw.trim();
  if (!email) return "required";
  return EMAIL_SHAPE.test(email) ? null : "badEmail";
};

export const passwordProblem = (raw: string): string | null => {
  if (!raw) return "required";
  return raw.length < MIN_PASSWORD ? "shortPassword" : null;
};

// the field the old form did not have at all, which is how a typo became a lost account
export const confirmProblem = (password: string, confirm: string): string | null => {
  if (!confirm) return "required";
  return password === confirm ? null : "mismatch";
};

export interface SignUpFields {
  nickname: string;
  email: string;
  password: string;
  confirm: string;
}

export type FieldErrors = Partial<Record<keyof SignUpFields, string>>;

export function validateSignUp(fields: SignUpFields): FieldErrors {
  const errors: FieldErrors = {};
  const nickname = nicknameProblem(fields.nickname);
  const email = emailProblem(fields.email);
  const password = passwordProblem(fields.password);
  const confirm = confirmProblem(fields.password, fields.confirm);
  if (nickname) errors.nickname = nickname;
  if (email) errors.email = email;
  if (password) errors.password = password;
  if (confirm) errors.confirm = confirm;
  return errors;
}

export const isComplete = (errors: FieldErrors) => Object.keys(errors).length === 0;

// a rough read on the password, shown as a bar rather than as a rule, because a hard
// requirement for a symbol only ever produces a capital, a digit and a bang on the end
export const passwordStrength = (password: string): 0 | 1 | 2 | 3 => {
  if (password.length < MIN_PASSWORD) return 0;
  let score = 1;
  if (password.length >= 10) score += 1;
  if (/[^a-zA-Z]/.test(password) && /[a-zA-Z]/.test(password)) score += 1;
  return Math.min(score, 3) as 0 | 1 | 2 | 3;
};
