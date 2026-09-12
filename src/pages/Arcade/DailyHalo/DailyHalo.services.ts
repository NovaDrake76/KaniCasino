import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import UserContext from "../../../UserContext";
import {
  adoptGuestGame,
  checkGuestGuesses,
  getHaloStudents,
  getHaloToday,
  HaloPlay,
  HaloStats,
  HaloStudent,
  HaloToday,
  submitHaloGuess,
} from "../../../services/arcade/DailyHaloService";
import {
  clearGuestGuesses,
  countdown,
  readGuestGuesses,
  searchStudents,
  shareText,
  winRate,
  writeGuestGuesses,
} from "./dailyHalo.logic";
import i18n from "../../../i18n";

const SHARE_URL = "https://kanicasino.com/arcade/daily-halo";
const COPIED_MS = 2000;

export const useDailyHalo = () => {
  const { userData, toogleUserData, toogleUserFlow } = useContext(UserContext);
  const userId: string | undefined = userData?.id;

  const [pool, setPool] = useState<HaloStudent[]>([]);
  const [today, setToday] = useState<HaloToday | null>(null);
  const [play, setPlay] = useState<HaloPlay | null>(null);
  const [stats, setStats] = useState<HaloStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [term, setTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  const poolRef = useRef<HaloStudent[]>([]);
  const userRef = useRef(userData);
  userRef.current = userData;
  // the day a rollover reload already asked for, so a clock running ahead of the server
  // cannot turn the countdown into a request loop
  const reloadedFor = useRef<number | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [t, students] = await Promise.all([
        getHaloToday(),
        poolRef.current.length ? Promise.resolve(poolRef.current) : getHaloStudents(),
      ]);
      poolRef.current = students;
      setPool(students);
      setToday(t);
      const local = readGuestGuesses(t.day);
      if (t.signedIn) {
        if (local.length && (!t.play || t.play.guesses.length === 0)) {
          const adopted = await adoptGuestGame(local);
          setPlay(adopted.play);
          setStats(adopted.stats);
        } else {
          setPlay(t.play);
          setStats(t.stats);
        }
        clearGuestGuesses();
      } else {
        setPlay(await checkGuestGuesses(local));
        setStats(null);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // signing in or out mid-game changes whose game this is
  useEffect(() => {
    load();
  }, [load, userId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const msLeft = today ? new Date(today.nextAt).getTime() - now : 0;
  const expired = !!today && msLeft <= 0;

  useEffect(() => {
    if (!expired || !today || reloadedFor.current === today.day) return;
    reloadedFor.current = today.day;
    setTerm("");
    load();
  }, [expired, today, load]);

  const guessed = useMemo(() => new Set((play?.guesses || []).map((g) => g.student.name)), [play]);
  const suggestions = useMemo(() => searchStudents(pool, term, guessed), [pool, term, guessed]);

  const pick = async (student: HaloStudent) => {
    if (!today || !play || play.finished || submitting || guessed.has(student.name)) return;
    setTerm("");
    setSubmitting(true);
    try {
      if (today.signedIn) {
        const turn = await submitHaloGuess(student.name);
        setPlay(turn.play);
        setStats(turn.stats);
        const user = userRef.current;
        if (turn.play.finished && turn.play.reward > 0 && user) {
          toogleUserData({ ...user, walletBalance: (user.walletBalance || 0) + turn.play.reward });
        }
      } else {
        const next = await checkGuestGuesses([...play.guesses.map((g) => g.student.name), student.name]);
        writeGuestGuesses(today.day, next.guesses.map((g) => g.student.name));
        setPlay(next);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || i18n.t("arcade.halo.guessFailed"), { theme: "dark" });
    } finally {
      setSubmitting(false);
    }
  };

  const pickFirst = () => {
    if (suggestions[0]) pick(suggestions[0]);
  };

  const share = async () => {
    if (!today || !play?.finished) return;
    try {
      await navigator.clipboard.writeText(shareText(today.number, play.guesses, play.won, today.maxGuesses, SHARE_URL));
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      toast.error(i18n.t("arcade.halo.copyFailed"), { theme: "dark" });
    }
  };

  const retry = () => {
    setLoading(true);
    load();
  };

  const guesses = play?.guesses || [];
  const maxGuesses = today?.maxGuesses ?? 10;
  const distribution = stats?.distribution || [];
  const topBar = Math.max(1, ...distribution);

  return {
    loading,
    failed,
    retry,
    number: today?.number ?? 0,
    maxGuesses,
    guessesLeft: Math.max(0, maxGuesses - guesses.length),
    finished: !!play?.finished,
    won: !!play?.won,
    rows: [...guesses].reverse(),
    guessCount: guesses.length,
    hints: play?.hints || [],
    answer: play?.answer || null,
    reward: play?.reward || 0,
    adopted: !!play?.adopted,
    bestReward: today?.reward.best ?? 0,
    clock: countdown(msLeft),
    solves: today?.solves ?? 0,
    averageGuesses: today?.averageGuesses ?? null,
    yesterday: today?.yesterday ?? null,
    signedIn: !!today?.signedIn,
    signIn: () => toogleUserFlow(true),
    term,
    setTerm,
    suggestions,
    pick,
    pickFirst,
    submitting,
    share,
    copied,
    stats,
    winRate: winRate(stats),
    distribution,
    topBar,
  };
};
