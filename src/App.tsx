import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "./Routes";
import Header from "./components/header/index";
import { useEffect, useState } from "react";
import UserContext from "./UserContext";
import io from "socket.io-client";

function App() {
  const [isLogged, setIsLogged] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const socket = io("http://localhost:5000");

    socket.on("onlineUsers", (count) => {
      setOnlineUsers(count);
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

  return (
    <div className="flex flex-col h-screen items-start justify-start">
      <UserContext.Provider
        value={{
          isLogged,
          toggleLogin,
          userData,
          toogleUserData,
        }}
      >
        <Router>
          <Header onlineUsers={onlineUsers} />
          <div className="flex">
            <AppRoutes />
          </div>
        </Router>
      </UserContext.Provider>
      <div>footer</div>
    </div>
  );
}

export default App;
