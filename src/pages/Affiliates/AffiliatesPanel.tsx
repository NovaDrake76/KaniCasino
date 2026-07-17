import { useAffiliatesServices } from "./Affiliates.services";
import AffiliatesView from "./Affiliates.view";

interface Props {
  isOwner: boolean;
}

// the affiliates tab. referrals are always the logged-in user's own program, so the
// tab only renders on your own profile.
const AffiliatesPanel: React.FC<Props> = ({ isOwner }) => {
  const service = useAffiliatesServices();
  if (!isOwner) {
    return <p className="text-ink-muted py-8 text-center">Referrals are private.</p>;
  }
  return (
    <div className="w-full flex justify-center">
      <AffiliatesView {...service} />
    </div>
  );
};

export default AffiliatesPanel;
