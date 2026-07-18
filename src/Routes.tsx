import { Route, Routes, Navigate } from "react-router-dom";
import Home from "./pages/Home/Home";
import Profile from "./pages/Profile/Profile";
import CasePage from "./pages/CasePage/CasePage";
import Marketplace from "./pages/Market/Marketplace";
import CoinFlip from "./pages/Coin/CoinFlip";
import CrashGame from "./pages/Crash/Crash";
import Upgrade from "./pages/Upgrade/Upgrade";
import Slot from "./pages/Slot/Slot";
import Plinko from "./pages/Plinko";
import PrivacyPolicy from "./pages/About/PrivacyPolicy"
import ItemPage from "./pages/Market/ItemPage";
import Battles from "./pages/Battles/Battles";
import BattleRoom from "./pages/Battles/BattleRoom";
import ProvablyFair from "./pages/ProvablyFair";
import ReferralRedirect from "./pages/Affiliates/ReferralRedirect";
import Backoffice from "./pages/Backoffice/Backoffice";

const defaultRoutes = (
  <>
    <Route path="/" element={<Home />} />
    <Route path="/profile/:id" element={<Profile />} />
    <Route path="/case/:id" element={<CasePage />} />
    <Route path="/marketplace" element={<Marketplace />} />
    <Route path="/marketplace/item/:itemId" element={<ItemPage/>} />
    <Route path="/coinflip" element={<CoinFlip />} />
    <Route path="/crash" element={<CrashGame />} />
    <Route path="/upgrade" element={<Upgrade />} />
    <Route path="/slot" element={<Slot />} />
    <Route path="/plinko" element={<Plinko />} />
    <Route path="/battles" element={<Battles />} />
    <Route path="/battles/:id" element={<BattleRoom />} />
    <Route path="/provably-fair" element={<ProvablyFair />} />
    <Route path="/r/:code" element={<ReferralRedirect />} />
    <Route path="/backoffice" element={<Backoffice />} />
    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
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
