import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../../UserContext";
import { getCase, getCases } from "../../../services/cases/CaseServices";
import {
  listBattles,
  createBattle,
  getSocket,
  Battle,
  MODE_SLOTS,
  MODES,
} from "../../../services/battles/BattleService";
import { CaseInfo } from "./Battles.types";

export const useBattlesServices = () => {
  const { isLogged, toogleUserFlow } = useContext(UserContext);
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [selected, setSelected] = useState<CaseInfo[]>([]);
  const [mode, setMode] = useState("1v1");
  const [bakaMode, setBakaMode] = useState(false);
  const [search, setSearch] = useState("");
  const [loadingCases, setLoadingCases] = useState(true);
  const [waiting, setWaiting] = useState<Battle[]>([]);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const socket = getSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const consumedAdd = useRef(false);

  // a case may arrive preselected via ?add=<caseId> (from the case page)
  useEffect(() => {
    const addId = searchParams.get("add");
    if (!addId || consumedAdd.current) return;
    consumedAdd.current = true;
    getCase(addId)
      .then((c) => {
        if (c && c._id) {
          setSelected((prev) => [
            ...prev,
            { _id: c._id, title: c.title, image: c.image, price: c.price },
          ]);
        }
      })
      .catch(() => {
        // ignore; the param is cleared in finally either way
      })
      .finally(() => {
        searchParams.delete("add");
        setSearchParams(searchParams, { replace: true });
      });
  }, [searchParams, setSearchParams]);

  // cases are searched server-side (debounced) so it scales past a single page
  useEffect(() => {
    let active = true;
    setLoadingCases(true);
    const t = setTimeout(
      () => {
        getCases(search.trim())
          .then((d: CaseInfo[]) => active && setCases(d || []))
          .finally(() => active && setLoadingCases(false));
      },
      search ? 300 : 0
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [search]);

  useEffect(() => {
    listBattles().then((b) => setWaiting(b || []));
    const onList = (b: Battle[]) => setWaiting(b || []);
    socket.on("battle:list", onList);
    return () => {
      socket.off("battle:list", onList);
    };
  }, []);

  const entryCost = selected.reduce((s, c) => s + (c.price || 0), 0);
  const countOf = (caseId: string) =>
    selected.filter((c) => c._id === caseId).length;
  const addCase = (c: CaseInfo) => setSelected((prev) => [...prev, c]);
  const removeAt = (i: number) =>
    setSelected((prev) => prev.filter((_, idx) => idx !== i));

  const create = async () => {
    if (!isLogged) {
      toogleUserFlow(true);
      return;
    }
    if (!selected.length) {
      toast.error("Add at least one case", { theme: "dark" });
      return;
    }
    setCreating(true);
    const res = await createBattle({
      caseIds: selected.map((c) => c._id),
      mode,
      bakaMode,
    });
    setCreating(false);
    if (res.error) {
      toast.error(res.error, { theme: "dark" });
      return;
    }
    if (res.id) navigate(`/battles/${res.id}`);
  };

  return {
    modes: MODES,
    cases,
    selected,
    mode,
    bakaMode,
    search,
    loadingCases,
    waiting,
    creating,
    entryCost,
    currentSlots: MODE_SLOTS[mode],
    countOf,
    addCase,
    removeAt,
    clearSelected: () => setSelected([]),
    setMode,
    toggleBaka: () => setBakaMode((b) => !b),
    setSearch,
    create,
    openBattle: (battleId: string) => navigate(`/battles/${battleId}`),
    slotsFor: (m: string) => MODE_SLOTS[m],
  };
};
