import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UserContext from "../../UserContext";
import NicknameSettings from "./NicknameSettings";

// the spy records the call, a plain function owns the promise: a spy holding a rejected one
// has it reported as an unhandled rejection whoever ends up awaiting it
const changeCall = vi.fn();
let changeImpl: () => Promise<{ username: string; slug?: string }> = async () => ({ username: "Sakuya" });

vi.mock("../../services/users/UserServices", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  changeUsername: (name: string) => {
    changeCall(name);
    return changeImpl();
  },
}));

const toastError = vi.fn();
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: (m: string) => toastError(m) } }));

const toogleUserData = vi.fn();

const draw = (over: Record<string, unknown> = {}) =>
  render(
    <UserContext.Provider
      value={{ userData: { username: "Nova Drake", nameChangeAllowedAt: null, ...over }, toogleUserData }}
    >
      <NicknameSettings />
    </UserContext.Provider>
  );

const box = () => screen.getByLabelText(/nickname/i) as HTMLInputElement;
const button = () => screen.getByRole("button", { name: /save nickname/i }) as HTMLButtonElement;
const type = (value: string) => fireEvent.change(box(), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  changeImpl = async () => ({ username: "Sakuya" });
});

describe("changing your nickname from settings", () => {
  it("starts on the name you already have", () => {
    draw();
    expect(box().value).toBe("Nova Drake");
  });

  it("will not save a name that has not changed", () => {
    draw();
    expect(button().disabled).toBe(true);
  });

  it("sends the new name and tells the rest of the app about it", async () => {
    draw();
    type("Sakuya");
    fireEvent.click(button());

    await waitFor(() => expect(changeCall).toHaveBeenCalledWith("Sakuya"));
    await waitFor(() =>
      expect(toogleUserData).toHaveBeenCalledWith(expect.objectContaining({ username: "Sakuya" }))
    );
  });

  it("trims the name rather than sending the spaces", async () => {
    draw();
    type("  Sakuya  ");
    fireEvent.click(button());

    await waitFor(() => expect(changeCall).toHaveBeenCalledWith("Sakuya"));
  });

  it("refuses a name the server would reject anyway", () => {
    draw();
    type("a");
    fireEvent.click(button());

    expect(screen.getByText(/at least 2 characters/i)).toBeTruthy();
    expect(changeCall).not.toHaveBeenCalled();
  });

  it("says the name is taken in the player's own language, not the server's", async () => {
    changeImpl = async () => {
      throw Object.assign(new Error("Request failed"), {
        response: { data: { message: "That nickname is taken", reason: "taken" } },
      });
    };
    draw();
    type("Sakuya");
    fireEvent.click(button());

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("That nickname is taken."));
  });

  it("locks the field and names the date when the change was too soon", async () => {
    const next = new Date(Date.now() + 5 * 86400000).toISOString();
    changeImpl = async () => {
      throw Object.assign(new Error("Request failed"), {
        response: { data: { message: "later", reason: "tooSoon", nextChangeAt: next } },
      });
    };
    draw();
    type("Sakuya");
    fireEvent.click(button());

    await waitFor(() => expect(button().disabled).toBe(true));
    expect(screen.getByText(/you can change it again on/i)).toBeTruthy();
  });

  it("opens locked when the account is already inside the cooldown", () => {
    // /users/me carries the date, so the panel says when instead of letting somebody type a
    // name and find out only once they press the button
    draw({ nameChangeAllowedAt: new Date(Date.now() + 5 * 86400000).toISOString() });

    expect(button().disabled).toBe(true);
    expect(screen.getByText(/you can change it again on/i)).toBeTruthy();
  });
});
