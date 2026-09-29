"use client";

import { useRef, type ComponentProps, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

/** One responsive shell: content scrolls without resizing the task or its actions. */
export default function TaskSheet({
  open,
  onOpenChange,
  title,
  hero,
  footer,
  children,
  className = "",
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...contentProps
}: Omit<ComponentProps<typeof DialogContent>, "title"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  hero?: ReactNode;
  footer?: ReactNode;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        {...contentProps}
        className={`task-sheet ${className}`}
        onOpenAutoFocus={(event) => {
          opener.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          if (onCloseAutoFocus) onCloseAutoFocus(event);
          else if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
      >
        <header className="task-sheet-header">
          <DialogTitle>{title}</DialogTitle>
        </header>
        <div className={hero ? "task-sheet-hero" : undefined}>{hero}</div>
        <div className="task-sheet-body">{children}</div>
        <footer className="task-sheet-footer">{footer}</footer>
      </DialogContent>
    </Dialog>
  );
}
