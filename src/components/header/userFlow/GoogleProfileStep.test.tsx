import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GoogleProfileStep from "./GoogleProfileStep";
import UserContext from "../../../UserContext";

// the spy records the call, a plain function owns the promise: a spy holding a rejected one
// has it reported as an unhandled rejection whoever ends up awaiting it
const completeCall = vi.fn();
let completeImpl: () => Promise<{ token: string }> = async () => ({ token: "t" });

vi.mock("../../../services/auth/auth", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  completeGoogleSignup: (body: unknown) => {
    completeCall(body);
    return completeImpl();
  },
}));

const GOOGLE_FACE = "https://lh3.googleusercontent.com/a/face.jpg";

const pending = {
  needsProfile: true as const,
  ticket: "signed-ticket",
  suggested: { username: "Nova Drake", picture: GOOGLE_FACE },
};

const draw = (over: Partial<typeof pending.suggested> = {}, onCancel = vi.fn()) =>
  render(
    <UserContext.Provider value={{ toggleLogin: vi.fn(), userData: null } as never}>
      <MemoryRouter>
        <GoogleProfileStep
          pending={{ ...pending, suggested: { ...pending.suggested, ...over } }}
          marketingOptIn={false}
          onCancel={onCancel}
        />
      </MemoryRouter>
    </UserContext.Provider>
  );

const submit = (container: HTMLElement) => fireEvent.submit(container.querySelector("form")!);

describe("the step after google verifies somebody new", () => {
  beforeEach(() => {
    completeCall.mockReset();
    completeImpl = async () => ({ token: "t" });
  });

  it("fills the box with the google name, so most people just press the button", () => {
    draw();
    expect((screen.getByLabelText(/nickname/i) as HTMLInputElement).value).toBe("Nova Drake");
  });

  it("lets that name be replaced with anything", async () => {
    const { container } = draw();
    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: "Anonymous Kani" } });

    submit(container);

    await waitFor(() => expect(completeCall).toHaveBeenCalled());
    expect(completeCall.mock.calls[0][0].username).toBe("Anonymous Kani");
  });

  it("starts on google's picture, the one they arrived with", async () => {
    const { container } = draw();

    submit(container);

    await waitFor(() => expect(completeCall).toHaveBeenCalled());
    expect(completeCall.mock.calls[0][0].useGooglePicture).toBe(true);
  });

  it("takes the default instead when that is picked", async () => {
    // the reason this step exists: a player wanted google sign-in without their real photo
    // and name going onto a public leaderboard
    const { container } = draw();
    fireEvent.click(screen.getByRole("button", { name: /default/i }));

    submit(container);

    await waitFor(() => expect(completeCall).toHaveBeenCalled());
    expect(completeCall.mock.calls[0][0].useGooglePicture).toBe(false);
  });

  it("asks for no google picture when google sent none", async () => {
    const { container } = draw({ picture: null });

    submit(container);

    await waitFor(() => expect(completeCall).toHaveBeenCalled());
    expect(completeCall.mock.calls[0][0].useGooglePicture).toBe(false);
  });

  it("shows both pictures, so the choice is between two things you can see", () => {
    draw();
    const sources = screen.getAllByRole("button").flatMap((b) =>
      [...b.querySelectorAll("img")].map((i) => i.getAttribute("src"))
    );
    expect(sources).toContain(GOOGLE_FACE);
    expect(sources.some((src) => src && src !== GOOGLE_FACE)).toBe(true);
  });

  it("offers no picture choice when google sent no photo", () => {
    draw({ picture: null });
    expect(screen.queryByRole("button", { name: /from google/i })).toBeNull();
  });

  it("carries the ticket, since that is the only proof of who google verified", async () => {
    const { container } = draw();
    submit(container);

    await waitFor(() => expect(completeCall).toHaveBeenCalled());
    expect(completeCall.mock.calls[0][0].ticket).toBe("signed-ticket");
  });

  it("refuses to send a nickname the server would reject anyway", () => {
    const { container } = draw();
    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: "a" } });

    submit(container);

    expect(screen.getByText(/at least 2 characters/i)).toBeTruthy();
    expect(completeCall).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the name was taken while the form was open", async () => {
    completeImpl = async () => {
      throw Object.assign(new Error("Request failed"), {
        response: { data: { message: "That nickname is taken" } },
      });
    };
    const { container } = draw();

    submit(container);

    expect(await screen.findByText(/that nickname is taken/i)).toBeTruthy();
  });

  it("can be backed out of without creating anything", () => {
    const onCancel = vi.fn();
    draw({}, onCancel);

    fireEvent.click(screen.getByRole("button", { name: /use a different account/i }));

    expect(onCancel).toHaveBeenCalled();
    expect(completeCall).not.toHaveBeenCalled();
  });
});
