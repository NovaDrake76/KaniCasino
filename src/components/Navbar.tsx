import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <nav className="flex items-center justify-between p-4 bg-slate-400 w-screen">
      <Link to="/">KaniCasino</Link>
      <div className="font-bold text-xl text-blue-500">a</div>
    </nav>
  );
};

export default Navbar;
