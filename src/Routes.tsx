import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import CasePage from "./pages/CasePage";
import Marketplace from "./pages/Marketplace";
import CoinFlip from "./pages/CoinFlip";
import CrashGame from "./pages/Crash";

const defaultRoutes = (
  <>
    <Route path="/" element={<Home />} />
    <Route path="/profile/:id" element={<Profile />} />
    <Route path="/case/:id" element={<CasePage />} />
    <Route path="/vendingmachine" element={<Marketplace />} />
    <Route path="/bandit" element={<CoinFlip />} />
    <Route path="/oilrig" element={<CrashGame />} />
  </>
);

const AppRoutes = () => {
  return <Routes>{defaultRoutes}</Routes>;
};

export default AppRoutes;
