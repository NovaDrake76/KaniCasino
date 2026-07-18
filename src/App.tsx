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

const Header = lazy(() => import("./components/header/index"));
const AppRoutes = lazy(() => import("./Routes"));
const environment = import.meta.env.VITE_NODE_ENV || "";
import { User } from './components/Types'

interface userDataSocketProps {
  walletBalance: number;
  xp: number;
  level: number;
}

function App() {
  const [isLogged, setIsLogged] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [userData, setUserData] = useState<User | null>(null);
  const [recentCaseOpenings, setRecentCaseOpenings] = useState<any>([]);
  const [openUserFlow, setOpenUserFlow] = useState<boolean>(false);
  const [notification, setNotification] = useState<any>();

  const socket = SocketConnection.getInstance();
  const missionCheck = useRef<{ inFlight: boolean; last: number }>({ inFlight: false, last: 0 });
  const userIdRef = useRef<string | null>(null);

  if(environment == "production"){
    disableReactDevTools();
  }

  // ask the server for missions that just became claimable and toast them once.
  // best-effort: throttled on the frequent light path, never blocks anything.
  const checkMissions = (light: boolean) => {
    if (!localStorage.getItem("accessToken")) return;
    const c = missionCheck.current;
    if (c.inFlight) return;
    if (light && Date.now() - c.last < 1500) return;
    c.inFlight = true;
    const missionsPath = userIdRef.current ? `/profile/${userIdRef.current}?tab=missions` : undefined;
    getPendingMissions(light)
      .then((pending) => {
        pending.forEach((m) => toastMissionComplete(m, missionsPath));
        c.last = Date.now();
      })
      .catch(() => {
        // best-effort: never let a mission check surface an error
      })
      .finally(() => {
        c.inFlight = false;
      });
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
      toast.info("Your session expired. Please log in again.");
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
    <div className="flex flex-col min-h-screen items-start justify-start bg-[#151225] text-white">
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
                />
                <div className="flex w-full">
                  <AppRoutes />
                </div>
                <div className="w-full pt-12">
                  <Footer />
                </div>
              </SkeletonTheme>
            </Router>
        </Suspense>

      </UserContext.Provider>
    </div>
  );
}

export default App;
