import { Route, Routes, Navigate } from "react-router-dom";
import Home from "./pages/Home/Home";
import Profile from "./pages/Profile/Profile";
import CasePage from "./pages/CasePage/CasePage";
import Marketplace from "./pages/Market/Marketplace";
import CoinFlip from "./pages/Coin/CoinFlip";
import CrashGame from "./pages/Crash/Crash";
import Upgrade from "./pages/Upgrade/Upgrade";
import Slot from "./pages/Slot/Slot";

const defaultRoutes = (
  <>
    <Route path="/" element={<Home />} />
    <Route path="/profile/:id" element={<Profile />} />
    <Route path="/case/:id" element={<CasePage />} />
    <Route path="/marketplace" element={<Marketplace />} />
    <Route path="/coinflip" element={<CoinFlip />} />
    <Route path="/crash" element={<CrashGame />} />
    <Route path="/upgrade" element={<Upgrade />} />
    <Route path="/slot" element={<Slot />} />
  </>
);

const AppRoutes = () => {
  return (
    <Routes>
      {defaultRoutes}
      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default AppRoutes;
