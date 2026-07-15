import { useMissionsServices } from "./Missions.services";
import MissionsView from "./Missions.view";

interface Props {
  userId: string;
  isOwner: boolean;
}

// the missions tab. missions are always the logged-in user's own progress, so the
// tab is only shown on your own profile (userId is accepted for a consistent tab
// interface but the API resolves the caller from the token).
const MissionsPanel: React.FC<Props> = ({ isOwner }) => {
  const service = useMissionsServices({ isOwner });
  return (
    <div className="w-full flex justify-center">
      <MissionsView {...service} />
    </div>
  );
};

export default MissionsPanel;
