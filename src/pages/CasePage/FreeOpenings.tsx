import { useEffect, useState } from "react";
import { FaGift } from "react-icons/fa";
import { countdown } from "../Gift/Gift.services";
import type { GiftGrant } from "../../services/gift/GiftService";

interface FreeOpeningsProps {
  grant: GiftGrant;
}

// what the daily gift left on this case, kept beside the open button so the free
// openings are visible where they are spent
const FreeOpenings: React.FC<FreeOpeningsProps> = ({ grant }) => {
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="notched bg-accent-gold p-px">
      <div className="notched flex items-center gap-3 bg-[#19172D] px-5 py-3">
        <FaGift className="text-xl text-accent-gold" />
        <div className="flex flex-col leading-tight">
          <span className="font-bold">
            {grant.remaining} free {grant.remaining === 1 ? "opening" : "openings"} on this case
          </span>
          <span className="font-mono text-[11px] text-[#84819a]">
            expires in {countdown(grant.expiresAt) || "moments"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FreeOpenings;
