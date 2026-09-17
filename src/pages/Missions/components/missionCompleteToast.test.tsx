import { describe, it, expect, vi } from "vitest";
import { toastMissionComplete } from "./missionCompleteToast";

const shown: Array<{ onClose?: () => void }> = [];
vi.mock("react-toastify", () => ({
  toast: (_content: unknown, options: { onClose?: () => void }) => shown.push(options),
}));

const achievement = (key: string) => ({ key, title: key, reward: 100, achievement: true });

describe("achievement toasts", () => {
  it("show one at a time, each waiting for the one before it to close", () => {
    toastMissionComplete(achievement("first-case"));
    toastMissionComplete(achievement("first-bonus"));
    toastMissionComplete(achievement("men-kisser"));

    expect(shown).toHaveLength(1);

    shown[0].onClose?.();
    expect(shown).toHaveLength(2);

    shown[1].onClose?.();
    expect(shown).toHaveLength(3);

    shown[2].onClose?.();
    toastMissionComplete(achievement("cases-10"));
    expect(shown).toHaveLength(4);
  });
});
