import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setNavigator } from "../services/navigation";

// registers react-router's navigate with the navigation bridge so out-of-tree code
// (toasts fired from App) can navigate client-side. Renders nothing.
const NavigationBridge = () => {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigator(navigate);
    return () => setNavigator(null);
  }, [navigate]);
  return null;
};

export default NavigationBridge;
