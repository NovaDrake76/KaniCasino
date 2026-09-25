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

vi.mock("../../services/daisu/ShopService", () => ({
  getShop: () => Promise.resolve({ level: 6, walletBalance: 0, items: [{ key: "chatPass", price: 500, level: 5, owned: false, via: null }] }),
}));

const message = (id: string, text: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  _id: `u${id}`,
  userId: `u${id}`,
  username: `player${id}`,
  profilePicture: "",
  level: 5,
  badge: null,
  text,
  at: Date.UTC(2026, 7, 30, 14, 5),
  ...over,
});

// jsdom does no layout, so the list is handed a height to scroll through
const withLayout = (el: HTMLElement, layout: { height: number; view: number }) => {
  let top = 0;
  Object.defineProperties(el, {
    scrollHeight: { configurable: true, get: () => layout.height },
    clientHeight: { configurable: true, get: () => layout.view },
    scrollTop: { configurable: true, get: () => top, set: (v: number) => (top = v) },
  });
  return el;
};

const history = (n: number) => Array.from({ length: n }, (_, i) => message(String(i), `line ${i}`));

const draw = (logged = true, me: Record<string, unknown> = {}) =>
  render(
    <UserContext.Provider value={{ userData: logged ? { id: "me", ...me } : null } as never}>
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

  it("asks an account in daisu's beta for a chat pass instead of the box, and keeps reading open", async () => {
    draw(true, { features: { daisu: true }, unlocks: [] });
    act(() => handlers.history?.([message("1", "first")] as never));

    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.queryByPlaceholderText(/say something/i)).toBeNull();
    expect(screen.getByText(/talking needs a chat pass/i)).toBeTruthy();
    expect(await screen.findByText(/level 5 · K₽/i)).toBeTruthy();
  });

  it("renders the history it is handed, oldest at the top", () => {
    draw();
    act(() => handlers.history?.([message("1", "first"), message("2", "second")] as never));
    const rows = screen.getAllByText(/first|second/);
    expect(rows.map((r) => r.textContent)).toEqual(["first", "second"]);
  });

  it("opens on the newest message, at the bottom, rather than the oldest", () => {
    const { container } = draw();
    const list = withLayout(container.querySelector("ul") as HTMLElement, { height: 2400, view: 500 });

    act(() => handlers.history?.(history(40) as never));

    expect(list.scrollTop).toBe(2400);
  });

  it("keeps up with a new message for someone reading at the bottom", () => {
    const { container } = draw();
    const layout = { height: 2400, view: 500 };
    const list = withLayout(container.querySelector("ul") as HTMLElement, layout);
    act(() => handlers.history?.(history(40) as never));

    layout.height = 2460;
    act(() => handlers.message?.(message("new", "just now") as never));

    expect(list.scrollTop).toBe(2460);
  });

  it("leaves someone reading back where they are when a message arrives", () => {
    const { container } = draw();
    const layout = { height: 2400, view: 500 };
    const list = withLayout(container.querySelector("ul") as HTMLElement, layout);
    act(() => handlers.history?.(history(40) as never));

    list.scrollTop = 300;
    layout.height = 2460;
    act(() => handlers.message?.(message("new", "just now") as never));

    expect(list.scrollTop).toBe(300);
  });

  it("stays on the newest message when the list shrinks, unless they scrolled up to read", () => {
    let resized = () => undefined as void;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        constructor(fn: () => void) {
          resized = fn;
        }
      }
    );
    try {
      const { container } = draw();
      const layout = { height: 2400, view: 500 };
      const list = withLayout(container.querySelector("ul") as HTMLElement, layout);
      act(() => handlers.history?.(history(40) as never));

      // the rain strip turning up above the list after the history did
      list.scrollTop = 1900;
      fireEvent.scroll(list);
      layout.view = 450;
      resized();
      expect(list.scrollTop).toBe(2400);

      list.scrollTop = 300;
      fireEvent.scroll(list);
      resized();
      expect(list.scrollTop).toBe(300);
    } finally {
      vi.unstubAllGlobals();
    }
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

  it("links a name at the author, not at undefined", () => {
    draw();
    act(() => handlers.history?.([message("1", "first")] as never));

    const link = screen.getByText("player1").closest("a");
    expect(link?.getAttribute("href")).toBe("/profile/u1");
  });

  it("stacks the name above the message, both beside the avatar", () => {
    // it used to lay the name out on the avatar's row and drop the text below both, so a
    // long line wrapped back under the picture and the column stopped reading as a chat
    const { container } = draw();
    act(() => handlers.history?.([message("1", "first")] as never));

    const row = container.querySelector("li")!;
    const [avatarLink, nameLink] = Array.from(row.querySelectorAll("a"));
    const body = row.querySelector("p")!;

    // the name and the text share one column, and the avatar is not in it
    const column = nameLink.parentElement!.parentElement!;
    expect(column.contains(body)).toBe(true);
    expect(column.contains(avatarLink)).toBe(false);
    expect(nameLink.textContent).toBe("player1");
    expect(body.textContent).toBe("first");
  });

  it("puts the badge on the name row, not in the message", () => {
    const { container } = draw();
    act(() =>
      handlers.history?.([message("1", "first", { badge: { key: "contributor" } })] as never)
    );

    const nameLink = Array.from(container.querySelectorAll("a")).find(
      (a) => a.textContent === "player1"
    )!;
    const nameRow = nameLink.parentElement!;
    const body = container.querySelector("li p")!;

    expect(nameRow.querySelector("svg")).toBeTruthy();
    expect(body.querySelector("svg")).toBeNull();
    expect(body.textContent).toBe("first");
  });

  it("keeps the rules a click away rather than open", () => {
    // there is no moderator, so the rules are the moderation. they still do not get to
    // take a third of a 300px column until somebody asks for them.
    draw();
    act(() => handlers.history?.([] as never));

    expect(screen.queryByText(/No begging/)).toBeNull();
    fireEvent.click(screen.getByLabelText("Chat rules"));
    expect(screen.getByText(/No begging/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Close the rules"));
    expect(screen.queryByText(/No begging/)).toBeNull();
  });

  it("carries the links people would otherwise ask for in the room", () => {
    const { container } = draw();
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));

    expect(hrefs.some((h) => h && h.includes("x.com"))).toBe(true);
    expect(hrefs.some((h) => h && h.includes("discord"))).toBe(true);
  });

  it("puts the way out on the bar, beside the arrow that brings it back", () => {
    const close = vi.fn();
    render(
      <UserContext.Provider value={{ userData: { id: "me" } } as never}>
        <MemoryRouter>
          <ChatPanel open onClose={close} />
        </MemoryRouter>
      </UserContext.Provider>
    );
    fireEvent.click(screen.getAllByLabelText("Hide chat")[0]);
    expect(close).toHaveBeenCalled();
  });

  it("offers a way in rather than a dead box when nobody is logged in", () => {
    draw(false);
    expect(screen.queryByPlaceholderText("Say something")).toBeNull();
    expect(screen.getByText(/Log in to join/)).toBeTruthy();
  });
});
