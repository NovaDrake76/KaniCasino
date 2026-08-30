import { BrowserRouter as Router } from "react-router-dom";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import UserContext from "./UserContext";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-tooltip/dist/react-tooltip.css";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";
import SocketConnection from "./services/socket"
import { SESSION_EXPIRED_EVENT } from "./services/api";
import { clearTokens } from "./services/auth/authUtils";
import ScrollToTop from "./components/ScrollToTop";
import Footer from "./components/Footer";
import {disableReactDevTools} from '@fvilers/disable-react-devtools';
import { getPendingMissions } from "./services/missions/MissionService";
import { toastMissionComplete } from "./pages/Missions/components/missionCompleteToast";
import NavigationBridge from "./components/NavigationBridge";
import PageMeta from "./components/PageMeta";
import BootLoader from "./components/BootLoader";
import { useTranslation } from "react-i18next";
import OnboardingModal from "./components/OnboardingModal";
import ChatDock, { useChatDock } from "./components/chat/ChatDock";

const Header = lazy(() => import("./components/header/index"));
const AppRoutes = lazy(() => import("./Routes"));
const environment = import.meta.env.VITE_NODE_ENV || "";
import { User } from './components/Types'
import i18n from "./i18n";
import { SessionStatsProvider } from "./stats/SessionStatsContext";

interface userDataSocketProps {
  walletBalance: number;
  xp: number;
  level: number;
}

function App() {
  // the hook is only here to re-render on a language change; strings come from the singleton
  const { i18n: translator } = useTranslation();
  const language = translator.language;
  const [isLogged, setIsLogged] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [userData, setUserData] = useState<User | null>(null);
  const [recentCaseOpenings, setRecentCaseOpenings] = useState<any>([]);
  const [openUserFlow, setOpenUserFlow] = useState<boolean>(false);
  const [notification, setNotification] = useState<any>();

  const chat = useChatDock();
  const socket = SocketConnection.getInstance();
  const missionCheck = useRef<{ inFlight: boolean; timer: number | null; queuedAt: number }>({
    inFlight: false,
    timer: null,
    queuedAt: 0,
  });
  const userIdRef = useRef<string | null>(null);

  if(environment == "production"){
    disableReactDevTools();
  }

  // the light check rides on the balance socket, and an auto run changes the balance every
  // round: at the old 1.5s throttle that became a poll, one request per round-and-a-half,
  // each of which groups the player's entire ledger. it now waits for the activity to
  // stop, so a whole auto run costs one check instead of hundreds.
  const MISSION_QUIET_MS = 4000;
  const MISSION_MAX_WAIT_MS = 30000;

  const runMissionCheck = (light: boolean) => {
    const c = missionCheck.current;
    if (c.inFlight) return;
    c.inFlight = true;
    c.queuedAt = 0;
    const missionsPath = userIdRef.current ? `/profile/${userIdRef.current}?tab=missions` : undefined;
    getPendingMissions(light)
      .then((pending) => pending.forEach((m) => toastMissionComplete(m, missionsPath)))
      .catch(() => {
        // best-effort: never let a mission check surface an error
      })
      .finally(() => {
        c.inFlight = false;
      });
  };

  // ask the server for missions that just became claimable and toast them once.
  const checkMissions = (light: boolean) => {
    if (!localStorage.getItem("accessToken")) return;
    if (!light) return runMissionCheck(false);

    const c = missionCheck.current;
    const now = Date.now();
    if (!c.queuedAt) c.queuedAt = now;
    // a run that never goes quiet still gets checked, just not on every round
    if (now - c.queuedAt >= MISSION_MAX_WAIT_MS) {
      if (c.timer) window.clearTimeout(c.timer);
      c.timer = null;
      return runMissionCheck(true);
    }
    if (c.timer) window.clearTimeout(c.timer);
    c.timer = window.setTimeout(() => {
      c.timer = null;
      runMissionCheck(true);
    }, MISSION_QUIET_MS);
  };

  const userDataSocket = () => {
    socket.on("userDataUpdated", (payload: userDataSocketProps) => {
      setUserData(prevUserData => prevUserData ? {
        ...prevUserData,
        walletBalance: payload.walletBalance,
        xp: payload.xp,
        level: payload.level
      } : null);
      // a balance change usually means an action just resolved: check for completions
      checkMissions(true);
    });

    return () => {
      socket.off("userDataUpdated");
      const c = missionCheck.current;
      if (c.timer) window.clearTimeout(c.timer);
      c.timer = null;
    };
  }

  useEffect(() => {
    socket.on("onlineUsers", (count) => {
      setOnlineUsers(count);
    });

    socket.on("caseOpened", (data) => {
      data.timestamp = Date.now();
      // stable key so the live drop row can animate new entries in
      data.id = crypto.randomUUID();

      // Wait 7.5 seconds to show the notification
      setTimeout(() => {
        // cap the queue immutably as it grows; the oldest drop falls off the end
        setRecentCaseOpenings((prevOpenings: any) => [data, ...prevOpenings].slice(0, 20));
      }, 7500);
    });

    userDataSocket();

    return () => {
      socket.disconnect();
    };
  }, [socket]);

  // keyed on the account itself, not a "joined once" latch: logging out and into
  // another account in the same tab never remounts App, so a latch would leave the
  // socket in the old user's room and userIdRef pointing at them.
  useEffect(() => {
    const id = userData?.id ?? null;
    if (userIdRef.current === id) return;
    userIdRef.current = id;
    // reconnect so the handshake re-runs with the current token; the server
    // authenticates it and joins this user's private room, or none when logged out
    socket.disconnect();
    socket.connect();
    if (id) {
      // full catch-up check on login: seeds silently the first time, then toasts
      // anything completed while away
      checkMissions(false);
    }
  }, [socket, userData]);

  useEffect(() => {
    socket.on("newNotification", (notification) => {
      setNotification(notification);
    });

    return () => {
      socket.off("newNotification");
    };
  }, [socket]);

  // the tunnel watchdog re-rolls cloudflared on a far-region stall, which briefly drops the
  // socket; show a sticky toast (announced or on an unexpected drop) and clear it on reconnect
  useEffect(() => {
    const RECONNECT_ID = "server-reconnect";
    const showReconnecting = (msg?: string) => {
      if (toast.isActive(RECONNECT_ID)) return;
      toast.loading(msg || i18n.t("common.reconnectingToTheServer"), { toastId: RECONNECT_ID });
    };
    const onNotice = (p: { message?: string; seconds?: number }) => showReconnecting(p?.message);
    // ignore intentional client disconnects (the login/logout re-handshake below)
    const onDisconnect = (reason: string) => {
      if (reason !== "io client disconnect") showReconnecting();
    };
    const onConnect = () => {
      if (toast.isActive(RECONNECT_ID)) {
        toast.update(RECONNECT_ID, { render: "Reconnected", type: "success", isLoading: false, autoClose: 1500 });
      }
    };
    socket.on("serverNotice", onNotice);
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);
    return () => {
      socket.off("serverNotice", onNotice);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
    };
  }, [socket]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token !== null) {
      setIsLogged(true);
    }
  }, [isLogged]);

  // the token expired or was rejected: end the session and ask for a new login
  useEffect(() => {
    const onSessionExpired = () => {
      clearTokens();
      setIsLogged(false);
      setUserData(null);
      setOpenUserFlow(true);
      toast.info(i18n.t("common.yourSessionExpiredPlease"));
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);

  const toggleLogin = (state?: boolean) => {
    setIsLogged((prev) => (typeof state === "boolean" ? state : !prev));
  };

  const toogleUserData = (data: any) => {
    setUserData(data);
  };

  const toogleUserFlow = (state: boolean) => {
    setOpenUserFlow(state);
  }

  return (
    <div
      key={language}
      className="flex flex-col min-h-screen items-start justify-start bg-[#151225] text-white"
    >
      <UserContext.Provider
        value={{
          isLogged,
          toggleLogin,
          userData,
          toogleUserData,
          openUserFlow,
          toogleUserFlow
        }}
      >
        <SessionStatsProvider>
        <Suspense fallback={<BootLoader />}>
            <Router>
              <SkeletonTheme highlightColor="#161427" baseColor="#1c1a31">
                <ScrollToTop />
                <NavigationBridge />
                <PageMeta />
                <ToastContainer
                  position="top-right"
                  autoClose={4000}
                  hideProgressBar={false}
                  closeOnClick={false}
                  pauseOnHover={true}
                  draggable={false}
                  theme="dark" />
                <Header
                  onlineUsers={onlineUsers}
                  recentCaseOpenings={recentCaseOpenings}
                  notification={notification}
                  setNotification={setNotification}
                  chatOpen={chat.open}
                  onToggleChat={chat.toggle}
                />
                <OnboardingModal />
                <div className="flex w-full items-start">
                  <ChatDock open={chat.open} wide={chat.wide} onClose={chat.close} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex w-full">
                      <AppRoutes />
                    </div>
                    <div className="w-full pt-12">
                      <Footer />
                    </div>
                  </div>
                </div>
              </SkeletonTheme>
            </Router>
        </Suspense>
        </SessionStatsProvider>

      </UserContext.Provider>
    </div>
  );
}

export default App;
