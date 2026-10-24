"use client";

import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useId, useState, type ComponentProps } from "react";

export function PasswordInput({ visibilityLabel = "senha", ...props }: Omit<ComponentProps<"input">, "type"> & { visibilityLabel?: string }) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const id = props.id ?? generatedId;

  return (
    <div className="password-field">
      <LockKeyhole size={16} aria-hidden="true" />
      <input {...props} id={id} type={visible ? "text" : "password"} />
      <button type="button" className="password-visibility" aria-label={`${visible ? "Ocultar" : "Mostrar"} ${visibilityLabel}`} aria-controls={id} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
