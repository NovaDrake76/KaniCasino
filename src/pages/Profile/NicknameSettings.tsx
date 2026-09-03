import { useContext, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { changeUsername } from "../../services/users/UserServices";
import { authError } from "../../services/auth/auth";
import { MAX_NAME, nicknameProblem } from "../../services/auth/authRules";
import UserContext from "../../UserContext";
import Field from "../../components/Field";
import MainButton from "../../components/MainButton";
import i18n from "../../i18n";

const NicknameSettings = () => {
    const { userData, toogleUserData } = useContext(UserContext);
    const current = userData?.username || "";
    const [nickname, setNickname] = useState(current);
    const [touched, setTouched] = useState(false);
    const [saving, setSaving] = useState(false);
    // the server sends the date rather than a flag, so the panel can say when instead of
    // letting somebody type a name and find out only once they press the button
    const [allowedAt, setAllowedAt] = useState<string | null>(userData?.nameChangeAllowedAt || null);

    const problem = useMemo(() => nicknameProblem(nickname), [nickname]);
    const unchanged = nickname.trim() === current;
    const locked = !!allowedAt && new Date(allowedAt) > new Date();

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (problem || unchanged || saving || locked) return;

        setSaving(true);
        try {
            const data = await changeUsername(nickname.trim());
            toogleUserData({ ...userData, username: data.username, slug: data.slug });
            toast.success(i18n.t("settings.nicknameSaved"), { theme: "dark" });
        } catch (err) {
            const data = (err as { response?: { data?: { reason?: string; nextChangeAt?: string } } })?.response?.data;
            if (data?.nextChangeAt) setAllowedAt(data.nextChangeAt);
            const key = data?.reason ? `auth.errors.${data.reason}` : null;
            const message = key && i18n.exists(key) ? i18n.t(key) : authError(err, i18n.t("settings.saveFailed"));
            toast.error(message, { theme: "dark" });
        }
        setSaving(false);
    };

    const until = locked && allowedAt ? new Date(allowedAt).toLocaleDateString(i18n.language) : null;

    return (
        <>
            <span className="text-lg font-bold">{i18n.t("auth.nickname")}</span>

            <form onSubmit={save} className="flex flex-col gap-3 bg-surface border border-line rounded-lg p-4" noValidate>
                <Field
                    id="nickname"
                    label={i18n.t("settings.newNickname")}
                    value={nickname}
                    onChange={setNickname}
                    onBlur={() => setTouched(true)}
                    error={problem ? i18n.t(`auth.errors.${problem}`) : null}
                    touched={touched}
                    hint={until ? i18n.t("settings.nicknameLocked", { date: until }) : i18n.t("settings.nicknameHint")}
                    maxLength={MAX_NAME}
                    autoComplete="nickname"
                />

                <div className="self-start">
                    <MainButton
                        text={i18n.t("settings.saveNickname")}
                        onClick={() => undefined}
                        disabled={saving || unchanged || locked}
                        loading={saving}
                        submit
                    />
                </div>
            </form>
        </>
    );
};

export default NicknameSettings;
