import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import i18n from "../../../i18n";

interface FieldProps {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  // the message under the box, already translated. shown only once the field has been
  // touched, so a form does not open covered in complaints about boxes nobody has met yet.
  error?: string | null;
  touched?: boolean;
  hint?: string;
  autoComplete?: string;
  maxLength?: number;
  required?: boolean;
}

const Field = ({
  id, label, type = "text", value, onChange, onBlur, error, touched, hint, autoComplete, maxLength, required,
}: FieldProps) => {
  const [reveal, setReveal] = useState(false);
  const showError = !!error && !!touched;
  const isPassword = type === "password";

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          name={id}
          type={isPassword && reveal ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          maxLength={maxLength}
          required={required}
          aria-invalid={showError}
          aria-describedby={showError ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`w-full border-b-2 bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:bg-surface-raised ${
            isPassword ? "pr-10" : ""
          } ${showError ? "border-red-500" : "border-line focus:border-accent"}`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((was) => !was)}
            aria-label={reveal ? i18n.t("auth.hidePassword") : i18n.t("auth.showPassword")}
            className="absolute right-0 top-0 flex h-full w-10 items-center justify-center border-none bg-transparent p-0 text-ink-faint hover:border-none hover:text-ink-soft"
          >
            {reveal ? <FiEyeOff /> : <FiEye />}
          </button>
        )}
      </div>

      {showError ? (
        <span id={`${id}-error`} role="alert" className="text-[11px] text-red-400">
          {error}
        </span>
      ) : (
        hint && <span id={`${id}-hint`} className="text-[11px] text-ink-faint">{hint}</span>
      )}
    </div>
  );
};

export default Field;
