import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import { getGift, spinGift } from "../../services/gift/GiftService";
import { reelItems, wonItem } from "./Gift.services";
import GiftView from "./Gift.view";
import type { BasicItem } from "../../components/Types";
import type { GiftCategory, GiftStage, GiftState, SpinResult } from "./Gift.types";
import i18n from "../../i18n";

// the reel animation the shared Roulette runs, so the prize lands with it rather than before
const REEL_MS = 7100;

const Gift = () => {
  const { userData } = useContext(UserContext);
  const navigate = useNavigate();

  const [state, setState] = useState<GiftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<GiftStage>("picking");
  const [category, setCategory] = useState<GiftCategory | null>(null);
  const [pending, setPending] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [landing, setLanding] = useState<BasicItem | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [landedTopSlot, setLandedTopSlot] = useState<number | null>(null);

  // memoised because the reel reshuffles on every new items array, which was re-randomising
  // the faces on each tick; it is rebuilt once when the winning face is known
  const reel = useMemo(
    () => (category ? reelItems(category.slots, landing) : []),
    [category, landing]
  );

  useEffect(() => {
    if (!userData?.id) return;
    getGift()
      .then(setState)
      .catch(() => setState(null))
      .finally(() => setLoading(false));
  }, [userData?.id]);

  const onPick = (name: string) => {
    const found = state?.categories.find((c) => c.category === name) || null;
    if (!found) return;
    setCategory(found);
    setResult(null);
    setLanding(null);
    setLandedTopSlot(null);
    setStage("charging");
  };

  const onBack = () => {
    setCategory(null);
    setResult(null);
    setLanding(null);
    setLandedTopSlot(null);
    setStage("picking");
  };

  const onSpin = async () => {
    if (!category || pending || spinning) return;
    setPending(true);
    try {
      const res = await spinGift(category.category);
      // the reel only plants the winner when it rebuilds, so it starts after the answer lands
      setLanding(wonItem(category.slots, res.won.caseId, res.won.opens));
      // the row is driven to the answer rather than snapping onto it when the reel ends
      setLandedTopSlot(res.topSlot.multiplier);
      setStage("spinning");
      setSpinning(true);
      setTimeout(() => {
        setResult(res);
        setState(res.state);
        setStage("won");
        setSpinning(false);
        setPending(false);
      }, REEL_MS);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || i18n.t("gift.couldNotOpenYour"), { theme: "dark" });
      setPending(false);
    }
  };

  if (!userData?.id) {
    return (
      <div className="flex w-full justify-center p-16">
        <span className="text-ink-muted">{i18n.t("gift.logInToOpen")}</span>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center">
      <GiftView
        loading={loading}
        state={state}
        stage={stage}
        category={category}
        reel={reel}
        landing={landing}
        spinning={spinning}
        landedTopSlot={landedTopSlot}
        pending={pending}
        result={result}
        onPick={onPick}
        onBack={onBack}
        onSpin={onSpin}
        onOpen={(caseId) => navigate(`/case/${caseId}`)}
      />
    </div>
  );
};

export default Gift;
