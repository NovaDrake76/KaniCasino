export type CouponProblem = "unknown" | "already" | "off" | "expired" | "usedUp" | "tooMany" | "verify" | "limited" | "retry";

export type CouponState =
  | { kind: "idle" }
  | { kind: "needLogin" }
  | { kind: "working" }
  | { kind: "done"; amount: number }
  | { kind: "failed"; problem: CouponProblem };

export interface CouponViewProps {
  code: string;
  setCode: (code: string) => void;
  state: CouponState;
  submit: (e: React.FormEvent) => void;
  logIn: () => void;
  discordUrl: string;
}
