import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Market from "./pages/Market";
import Profile from "./pages/Profile";
import CasePage from "./pages/CasePage";
import Marketplace from "./pages/Marketplace";

const defaultRoutes = (
  <>
    <Route path="/" element={<Home />} />
    <Route path="/market" element={<Market />} />
    <Route path="/profile/:id" element={<Profile />} />
    <Route path="/case/:id" element={<CasePage />} />
    <Route path="/marketplace" element={<Marketplace />} />
  </>
);

const AppRoutes = () => {
  return <Routes>{defaultRoutes}</Routes>;
};

export default AppRoutes;
