import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  getSeed,
  setClientSeed,
  rotateSeed,
  getRoll,
  getRollByItem,
  verifyRoll,
  SeedState,
  RevealedSeed,
  RollView,
  VerifyResult,
} from "../../services/fair/FairServices";
import i18n from "../../i18n";

export const useProvablyFairServices = () => {
  const [searchParams] = useSearchParams();
  const [seed, setSeed] = useState<SeedState | null>(null);
  const [clientSeedInput, setClientSeedInput] = useState("");
  const [savingSeed, setSavingSeed] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [revealed, setRevealed] = useState<RevealedSeed | null>(null);
  const [rollIdInput, setRollIdInput] = useState("");
  const [roll, setRoll] = useState<RollView | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const lookup = async (id?: string) => {
    const rid = (id ?? rollIdInput).trim();
    if (!rid) return;
    setLookingUp(true);
    setRoll(null);
    setVerify(null);
    try {
      setRoll(await getRoll(rid));
    } catch {
      toast.error(i18n.t("fair.rollNotFound"), { theme: "dark" });
    }
    setLookingUp(false);
  };

  // resolve an inventory item (by uniqueId) to the roll that produced it
  const lookupByItem = async (uniqueId: string) => {
    setLookingUp(true);
    setRoll(null);
    setVerify(null);
    try {
      const r = await getRollByItem(uniqueId);
      setRoll(r);
      setRollIdInput(r.rollId);
    } catch {
      toast.error(i18n.t("fair.noProvablyFairRoll"), { theme: "dark" });
    }
    setLookingUp(false);
  };

  // load the active seed (authenticated users); guests still get the lookup
  useEffect(() => {
    getSeed()
      .then((s) => {
        setSeed(s);
        setClientSeedInput(s.clientSeed);
      })
      .catch(() => setSeed(null));
    const rid = searchParams.get("roll"); // deep link: /provably-fair?roll=R123
    if (rid) {
      setRollIdInput(rid);
      lookup(rid);
    }
    const item = searchParams.get("item"); // deep link: /provably-fair?item=<uniqueId>
    if (item) lookupByItem(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveClientSeed = async () => {
    const v = clientSeedInput.trim();
    if (!v) return;
    setSavingSeed(true);
    try {
      setSeed(await setClientSeed(v));
      toast.success(i18n.t("fair.clientSeedUpdated"), { theme: "dark" });
    } catch {
      toast.error(i18n.t("fair.couldNotUpdateClient"), { theme: "dark" });
    }
    setSavingSeed(false);
  };

  const rotate = async () => {
    setRotating(true);
    try {
      const res = await rotateSeed();
      setSeed(res.current);
      setClientSeedInput(res.current.clientSeed);
      setRevealed(res.revealed);
      toast.success(i18n.t("fair.serverSeedRotatedAnd"), { theme: "dark" });
    } catch {
      toast.error(i18n.t("fair.couldNotRotateSeed"), { theme: "dark" });
    }
    setRotating(false);
  };

  const doVerify = async () => {
    if (!roll) return;
    setVerifying(true);
    try {
      setVerify(await verifyRoll(roll.rollId));
    } catch {
      toast.error(i18n.t("fair.couldNotVerify"), { theme: "dark" });
    }
    setVerifying(false);
  };

  return {
    seed,
    clientSeedInput,
    setClientSeedInput,
    savingSeed,
    saveClientSeed,
    rotating,
    rotate,
    revealed,
    rollIdInput,
    setRollIdInput,
    roll,
    lookingUp,
    lookup,
    verify,
    verifying,
    doVerify,
  };
};
