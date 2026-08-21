import { useContext, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Modal from "../../components/Modal";
import UserContext from "../../UserContext";
import { AvatarOption, getAvatarOptions, setAvatar } from "../../services/users/UserServices";
import { rarityColor } from "../../utils/rarity";
import i18n from "../../i18n";

interface AvatarPickerProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onPicked?: () => void;
}

interface TileProps {
  image: string;
  label: string;
  color: string;
  count?: number;
  selected: boolean;
  busy: boolean;
  onPick: () => void;
}

const Tile: React.FC<TileProps> = ({ image, label, color, count, selected, busy, onPick }) => (
  <button
    onClick={onPick}
    disabled={busy}
    title={label}
    style={{ backgroundColor: selected ? color : "transparent" }}
    className={`notched-sm p-[2px] transition-opacity ${busy ? "opacity-40" : "hover:opacity-80"}`}
  >
    <div className="notched-sm flex h-full flex-col items-center gap-1 bg-[#212031] p-2">
      <div className="relative">
        <img src={image} alt={label} className="h-16 w-16 rounded-full object-cover" />
        {!!count && count > 1 && (
          <span className="notched-xs absolute -bottom-1 -right-1 bg-[#19172d] px-1.5 py-0.5 text-[10px] font-bold text-[#C9C6DE]">
            x{count}
          </span>
        )}
      </div>
      <span className="w-full truncate text-center text-[11px] text-[#C9C6DE]">{label}</span>
    </div>
  </button>
);

// the only avatars that exist are the items a player already owns, so there is nothing to
// upload and nothing to moderate
const AvatarPicker: React.FC<AvatarPickerProps> = ({ open, setOpen, onPicked }) => {
  const [items, setItems] = useState<AvatarOption[]>([]);
  const [current, setCurrent] = useState("");
  const [base, setBase] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const { userData, toogleUserData } = useContext(UserContext);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getAvatarOptions()
      .then((data) => {
        setItems(data.items);
        setCurrent(data.current);
        setBase(data.base);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((item) => item.name.toLowerCase().includes(term)) : items;
  }, [items, search]);

  const pick = async (itemId: string | null) => {
    if (saving) return;
    setSaving(itemId || "base");
    try {
      const res = await setAvatar(itemId);
      setCurrent(res.profilePicture);
      // the navbar avatar lives in app state, not on the profile, so it stays stale otherwise
      if (userData) toogleUserData({ ...userData, profilePicture: res.profilePicture });
      onPicked && onPicked();
      toast.success(i18n.t("profile.avatarUpdated"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || i18n.t("profile.avatarFailed"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal open={open} setOpen={setOpen} width="min(560px, 95vw)">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">{i18n.t("profile.avatarTitle")}</h2>
          <p className="mt-1 text-xs text-[#84819A]">
            {i18n.t("profile.avatarSubtitle", { count: items.length })}
          </p>
        </div>

        {items.length > 8 && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={i18n.t("profile.avatarSearch")}
            className="notched-sm bg-[#212031] px-3 py-2 text-sm text-white outline-none placeholder:text-[#625F7E]"
          />
        )}

        {loading ? (
          <p className="py-6 text-center text-sm text-[#84819A]">{i18n.t("common.loading")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {base && (
              <Tile
                image={base}
                label={i18n.t("profile.avatarDefault")}
                color="#4F46E5"
                selected={current === base}
                busy={saving === "base"}
                onPick={() => pick(null)}
              />
            )}
            {shown.map((item) => (
              <Tile
                key={item.itemId}
                image={item.image}
                label={item.name}
                color={rarityColor(item.rarity)}
                count={item.count}
                selected={current === item.image}
                busy={saving === item.itemId}
                onPick={() => pick(item.itemId)}
              />
            ))}
          </div>
        )}

        {!loading && !items.length && (
          <p className="py-2 text-center text-sm text-[#84819A]">{i18n.t("profile.avatarEmpty")}</p>
        )}
      </div>
    </Modal>
  );
};

export default AvatarPicker;
