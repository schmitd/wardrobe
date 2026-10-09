"use client";

import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { OPEN_CAPTURE_MENU_EVENT } from "@/lib/captureEvents";

export type CaptureIntent = "my_wardrobe" | "just_trying";

/** Add enters capture directly. Empty-state actions share the visible trigger. */
export function CaptureMenu({ variant, disabled, onSelect, onOpen }: {
  variant: "mobile" | "desktop";
  disabled: boolean;
  onSelect: (intent: CaptureIntent) => void;
  onOpen: () => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const show = () => {
      if (!disabled && trigger.current?.getClientRects().length) {
        onOpen(); onSelect("my_wardrobe");
      }
    };
    window.addEventListener(OPEN_CAPTURE_MENU_EVENT, show);
    return () => window.removeEventListener(OPEN_CAPTURE_MENU_EVENT, show);
  }, [disabled, onOpen, onSelect]);
  return <button ref={trigger} type="button" disabled={disabled} aria-label="Add outfit"
    className={`rack-capture-trigger rack-capture-trigger--${variant}`}
    onClick={() => { onOpen(); onSelect("my_wardrobe"); }}>
    <Plus className="rack-capture-plus" aria-hidden="true" strokeWidth={2.25} />
    {variant === "desktop" && <span>Add</span>}
  </button>;
}
