import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "./Routes";
import Navbar from "./components/Navbar";

function App() {
  return (
    <div className="flex flex-col h-screen items-start justify-start">
      <Router>
        <Navbar />
        <div className="flex">
          <AppRoutes />
        </div>
      </Router>
      <div>footer</div>
    </div>
  );
}

export default App;
