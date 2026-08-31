import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ChatPanel from "./ChatPanel";
import UserContext from "../../UserContext";
import type { ChatMessage } from "../../services/chat/ChatService";

const handlers: Record<string, (p: never) => void> = {};
const sendMessage = vi.fn();
const requestHistory = vi.fn();

vi.mock("../../services/chat/ChatService", () => ({
  requestHistory: () => requestHistory(),
  sendMessage: (text: string) => sendMessage(text),
  reportMessage: () => Promise.resolve({ ok: true }),
  onHistory: (fn: (p: never) => void) => {
    handlers.history = fn;
    return () => delete handlers.history;
  },
  onMessage: (fn: (p: never) => void) => {
    handlers.message = fn;
    return () => delete handlers.message;
  },
  onRemoved: (fn: (p: never) => void) => {
    handlers.removed = fn;
    return () => delete handlers.removed;
  },
}));

const message = (id: string, text: string): ChatMessage => ({
  id,
  userId: `u${id}`,
  username: `player${id}`,
  profilePicture: "",
  level: 5,
  badge: null,
  text,
  at: Date.UTC(2026, 7, 30, 14, 5),
});

const draw = (logged = true) =>
  render(
    <UserContext.Provider value={{ userData: logged ? { id: "me" } : null } as never}>
      <MemoryRouter>
        <ChatPanel open onClose={() => undefined} />
      </MemoryRouter>
    </UserContext.Provider>
  );

describe("the site chat panel", () => {
  beforeEach(() => {
    sendMessage.mockReset().mockResolvedValue({ ok: true });
    requestHistory.mockReset();
  });

  it("asks for history once it is opened, rather than waiting to be pushed it", () => {
    draw();
    expect(requestHistory).toHaveBeenCalledTimes(1);
  });

  it("renders the history it is handed, oldest at the top", () => {
    draw();
    act(() => handlers.history?.([message("1", "first"), message("2", "second")] as never));
    const rows = screen.getAllByText(/first|second/);
    expect(rows.map((r) => r.textContent)).toEqual(["first", "second"]);
  });

  it("shows a timestamp, because a quiet room can have an hours old message", () => {
    draw();
    act(() => handlers.history?.([message("1", "first")] as never));
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeTruthy();
  });

  it("clears the box only when the message actually went", async () => {
    draw();
    act(() => handlers.history?.([] as never));
    const box = screen.getByPlaceholderText("Say something");

    fireEvent.change(box, { target: { value: "hello" } });
    fireEvent.submit(box.closest("form")!);

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith("hello"));
    await waitFor(() => expect((box as HTMLInputElement).value).toBe(""));
  });

  it("keeps the text when it was refused, so it is not lost to a rate limit", async () => {
    sendMessage.mockResolvedValue({ error: "slowDown" });
    draw();
    act(() => handlers.history?.([] as never));
    const box = screen.getByPlaceholderText("Say something");

    fireEvent.change(box, { target: { value: "hello" } });
    fireEvent.submit(box.closest("form")!);

    expect(await screen.findByText(/Slow down/)).toBeTruthy();
    expect((box as HTMLInputElement).value).toBe("hello");
  });

  it("says why a link was refused rather than failing silently", async () => {
    sendMessage.mockResolvedValue({ error: "noLinks" });
    draw();
    act(() => handlers.history?.([] as never));
    const box = screen.getByPlaceholderText("Say something");

    fireEvent.change(box, { target: { value: "http://spam.com" } });
    fireEvent.submit(box.closest("form")!);

    expect(await screen.findByText(/Links are not allowed/)).toBeTruthy();
  });

  it("drops a message the moment it is taken down", () => {
    draw();
    act(() => handlers.history?.([message("1", "regrettable")] as never));
    expect(screen.getByText("regrettable")).toBeTruthy();

    act(() => handlers.removed?.({ id: "1" } as never));
    expect(screen.queryByText("regrettable")).toBeNull();
  });

  it("offers a way in rather than a dead box when nobody is logged in", () => {
    draw(false);
    expect(screen.queryByPlaceholderText("Say something")).toBeNull();
    expect(screen.getByText(/Log in to join/)).toBeTruthy();
  });
});
