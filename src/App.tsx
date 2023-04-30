import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "./Routes";
import Header from "./components/header/index";
import { useEffect, useState } from "react";
import UserContext from "./UserContext";

function App() {
  const [isLogged, setIsLogged] = useState<boolean>(false);
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token !== null) {
      setIsLogged(true);
    }
  }, [isLogged]);

  const toggleLogin = () => {
    setIsLogged(!isLogged);
  };

  return (
    <div className="flex flex-col h-screen items-start justify-start">
      <UserContext.Provider
        value={{
          isLogged,
          toggleLogin,
        }}
      >
        <Router>
          <Header />
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
