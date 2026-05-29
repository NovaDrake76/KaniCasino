import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UserContext from "../../UserContext";
import FriendButton from "./FriendButton";
import * as UserServices from "../../services/users/UserServices";

vi.mock("../../services/users/UserServices");
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderWithUser = (ui: React.ReactNode, ctx: any) =>
  render(<UserContext.Provider value={ctx}>{ui}</UserContext.Provider>);

const loggedIn = { isLogged: true, toogleUserFlow: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FriendButton", () => {
  it("renders nothing when logged out", () => {
    const { container } = renderWithUser(
      <FriendButton profileId="abc" isSameUser={false} />,
      { isLogged: false, toogleUserFlow: vi.fn() }
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing on your own profile", () => {
    vi.mocked(UserServices.getFriendStatus).mockResolvedValue({ status: "self" });
    const { container } = renderWithUser(
      <FriendButton profileId="me" isSameUser={true} />,
      loggedIn
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows Add Friend and sends a request on click", async () => {
    vi.mocked(UserServices.getFriendStatus).mockResolvedValue({ status: "none" });
    vi.mocked(UserServices.sendFriendRequest).mockResolvedValue({});

    renderWithUser(<FriendButton profileId="abc" isSameUser={false} />, loggedIn);

    const btn = await screen.findByText("Add Friend");
    fireEvent.click(btn);

    expect(UserServices.sendFriendRequest).toHaveBeenCalledWith("abc");
    expect(await screen.findByText("Request sent")).toBeInTheDocument();
  });

  it("shows the friends state when already friends", async () => {
    vi.mocked(UserServices.getFriendStatus).mockResolvedValue({ status: "friends" });
    renderWithUser(<FriendButton profileId="abc" isSameUser={false} />, loggedIn);
    expect(await screen.findByText("Friends ✓")).toBeInTheDocument();
  });

  it("accepts an incoming request", async () => {
    vi.mocked(UserServices.getFriendStatus).mockResolvedValue({ status: "incoming" });
    vi.mocked(UserServices.acceptFriendRequest).mockResolvedValue({});
    renderWithUser(<FriendButton profileId="abc" isSameUser={false} />, loggedIn);

    const accept = await screen.findByText("Accept request");
    fireEvent.click(accept);
    expect(UserServices.acceptFriendRequest).toHaveBeenCalledWith("abc");
    expect(await screen.findByText("Friends ✓")).toBeInTheDocument();
  });
});
