import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import CasePage from "./pages/CasePage";
import Marketplace from "./pages/Marketplace";
import CoinFlip from "./pages/CoinFlip";

const defaultRoutes = (
  <>
    <Route path="/" element={<Home />} />
    <Route path="/profile/:id" element={<Profile />} />
    <Route path="/case/:id" element={<CasePage />} />
    <Route path="/marketplace" element={<Marketplace />} />
    <Route path="/coinflip" element={<CoinFlip />} />
  </>
);

const AppRoutes = () => {
  return <Routes>{defaultRoutes}</Routes>;
};

export default AppRoutes;
