import i18n from "../../../../i18n";

interface Props {
  bestReward: number;
  signIn: () => void;
}

const SignInNudge = ({ bestReward, signIn }: Props) => (
  <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl bg-white px-6 py-4 text-center shadow-lg md:flex-row md:text-left">
    <span className="text-sm font-semibold text-slate-600">
      {i18n.t("arcade.halo.signInLine", { amount: bestReward.toLocaleString("en-US") })}
    </span>
    <button
      type="button"
      onClick={signIn}
      className="rounded-xl border-none bg-[#0a8bfa] px-6 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-lg transition-colors hover:border-none hover:bg-blue-600"
    >
      {i18n.t("arcade.halo.signIn")}
    </button>
  </div>
);

export default SignInNudge;
