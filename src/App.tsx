import { BrowserRouter as Router } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import UserContext from "./UserContext";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-tooltip/dist/react-tooltip.css";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import SocketConnection from "./services/socket"


const Header = lazy(() => import("./components/header/index"));
const AppRoutes = lazy(() => import("./Routes"));

function App() {
  const [isLogged, setIsLogged] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [userData, setUserData] = useState<any>(null);
  const [recentCaseOpenings, setRecentCaseOpenings] = useState<any>([]);
  const socket = SocketConnection.getInstance();

  useEffect(() => {

    socket.on("onlineUsers", (count) => {
      setOnlineUsers(count);
    });

    socket.on("caseOpened", (data) => {
      //wait 7.5 seconds to remove the notification
      setTimeout(() => {
        setRecentCaseOpenings((prevOpenings: any) => [data, ...prevOpenings]);
      }, 7500);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token !== null) {
      setIsLogged(true);
    }
  }, [isLogged]);

  const toggleLogin = () => {
    setIsLogged(!isLogged);
  };

  const toogleUserData = (data: any) => {
    setUserData(data);
  };

  //if there's more than 20 items, remove the last one from the array
  useEffect(() => {
    if (recentCaseOpenings.length > 20) {
      setRecentCaseOpenings((prevOpenings: any) => {
        prevOpenings.pop();
        return prevOpenings;
      });
    }
  }, [recentCaseOpenings]);

  return (
    <div className="flex flex-col min-h-screen items-start justify-start bg-[#151225]">
      <UserContext.Provider
        value={{
          isLogged,
          toggleLogin,
          userData,
          toogleUserData,
        }}
      >
        <Suspense fallback={
          <div />
        }>
          <Router>
            <SkeletonTheme highlightColor="#161427" baseColor="#1c1a31">
              <ToastContainer />
              <Header
                onlineUsers={onlineUsers}
                recentCaseOpenings={recentCaseOpenings}
              />
              <div className="flex">
                <AppRoutes />
              </div>
              {/* <div className="">footer</div> */}
            </SkeletonTheme>
          </Router>
        </Suspense>

      </UserContext.Provider>
    </div>
  );
}

export default App;
