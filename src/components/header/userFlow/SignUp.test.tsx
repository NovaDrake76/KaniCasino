import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SignUp from "./SignUp";
import UserContext from "../../../UserContext";

// the spy records the call, a plain function owns the promise. a spy that holds a rejected
// promise has it reported as an unhandled rejection, whoever ends up awaiting it.
const registerCall = vi.fn();
let registerImpl: () => Promise<{ token: string }> = async () => ({ token: "t" });

vi.mock("../../../services/auth/auth", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  register: (...args: unknown[]) => {
    registerCall(...args);
    return registerImpl();
  },
  googleLogin: vi.fn(),
}));

// the google button pulls google's script in, which a jsdom run has no business fetching
vi.mock("@react-oauth/google", () => ({ GoogleLogin: () => <div data-testid="google" /> }));

const draw = () =>
  render(
    <UserContext.Provider value={{ toggleLogin: vi.fn(), userData: null } as never}>
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>
    </UserContext.Provider>
  );

const fill = (label: RegExp, value: string) => {
  const box = screen.getByLabelText(label);
  fireEvent.change(box, { target: { value } });
  fireEvent.blur(box);
};

const fillAll = () => {
  fill(/^nickname$/i, "Nova Drake");
  fill(/^email$/i, "nova@example.com");
  fill(/^password$/i, "password");
  fill(/repeat password/i, "password");
};

describe("the sign up form", () => {
  beforeEach(() => {
    registerCall.mockReset();
    registerImpl = async () => ({ token: "t" });
  });

  it("says nothing about fields nobody has touched yet", () => {
    draw();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("points at every empty field when submitted blank, rather than saying nothing", () => {
    const { container } = draw();

    fireEvent.submit(container.querySelector("form")!);

    expect(screen.getAllByText(/this one is needed/i).length).toBe(4);
    expect(registerCall).not.toHaveBeenCalled();
  });

  it("catches a password typed twice differently, which the old form could not", () => {
    draw();
    fill(/^password$/i, "password");
    fill(/repeat password/i, "passwrd");

    expect(screen.getByText(/do not match/i)).toBeTruthy();
  });

  it("says which way a nickname is wrong", () => {
    draw();

    fill(/^nickname$/i, "a");
    expect(screen.getByText(/at least 2 characters/i)).toBeTruthy();

    fill(/^nickname$/i, "nova<script>");
    expect(screen.getByText(/cannot start with a symbol/i)).toBeTruthy();
  });

  it("catches an address that is not one", () => {
    draw();
    fill(/^email$/i, "nova@example");

    expect(screen.getByText(/does not look like an email/i)).toBeTruthy();
  });

  it("clears a complaint once the field is fixed", () => {
    draw();
    fill(/^email$/i, "nope");
    expect(screen.getByText(/does not look like an email/i)).toBeTruthy();

    fill(/^email$/i, "nova@example.com");
    expect(screen.queryByText(/does not look like an email/i)).toBeNull();
  });

  it("registers with what was typed once the form is right", async () => {
    const { container } = draw();
    fillAll();

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(registerCall).toHaveBeenCalled());
    expect(registerCall.mock.calls[0].slice(0, 3)).toEqual(["nova@example.com", "password", "Nova Drake"]);
  });

  it("shows the server's reason rather than a generic failure", async () => {
    // axios rejects with an Error carrying the response, so the test does too
    const failure = Object.assign(new Error("Request failed"), {
      response: { data: { message: "Email already registered" } },
    });
    registerImpl = async () => {
      throw failure;
    };

    const { container } = draw();
    fillAll();

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText(/email already registered/i)).toBeTruthy();
  });

  it("does not send a half filled form to the server at all", () => {
    const { container } = draw();
    fill(/^nickname$/i, "Nova Drake");
    fill(/^email$/i, "nova@example.com");

    fireEvent.submit(container.querySelector("form")!);

    expect(registerCall).not.toHaveBeenCalled();
  });
});
