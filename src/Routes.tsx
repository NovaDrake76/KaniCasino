import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Market from "./pages/Market";
import Profile from "./pages/Profile";

const defaultRoutes = (
  <>
    <Route path="/" element={<Home />} />
    <Route path="/market" element={<Market />} />
    <Route path="/profile" element={<Profile />} />
  </>
);

const AppRoutes = () => {
  return <Routes>{defaultRoutes}</Routes>;
};

export default AppRoutes;
