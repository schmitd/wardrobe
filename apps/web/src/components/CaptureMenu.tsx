'use client';

import { useEffect, useRef, useState } from 'react';
import { DropdownMenu } from 'radix-ui';
import { Plus, Shirt, ScanSearch } from 'lucide-react';
import { OPEN_CAPTURE_MENU_EVENT } from '@/lib/captureEvents';

export type CaptureIntent = 'my_wardrobe' | 'just_trying';

export function CaptureMenu({ variant, disabled, onSelect, onOpen }: {
  variant: 'mobile' | 'desktop';
  disabled: boolean;
  onSelect: (intent: CaptureIntent) => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const show = () => {
      // Empty-state actions use the same visible navigation trigger.
      if (!disabled && trigger.current?.getClientRects().length) { onOpen(); setOpen(true); }
    };
    window.addEventListener(OPEN_CAPTURE_MENU_EVENT, show);
    return () => window.removeEventListener(OPEN_CAPTURE_MENU_EVENT, show);
  }, [disabled, onOpen]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const onBreakpoint = () => setOpen(false);
    desktop.addEventListener('change', onBreakpoint);
    return () => desktop.removeEventListener('change', onBreakpoint);
  }, []);

  return (
    <DropdownMenu.Root open={open && !disabled} onOpenChange={(next) => { if (next) onOpen(); setOpen(next); }} modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          disabled={disabled}
          aria-label={open ? 'Close add menu' : 'Add outfit'}
          className={`rack-capture-trigger rack-capture-trigger--${variant}`}
        >
          <Plus className="rack-capture-plus" aria-hidden="true" strokeWidth={2.25} />
          {variant === 'desktop' && <span>{open ? 'Close' : 'Add'}</span>}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="rack-capture-intent"
          side={variant === 'mobile' ? 'top' : 'bottom'}
          align="center"
          sideOffset={12}
          collisionPadding={12}
          aria-label="Add outfit"
          aria-labelledby={undefined}
        >
          <DropdownMenu.Item onSelect={() => onSelect('my_wardrobe')} className="rack-capture-intent-option">
            <Shirt size={21} aria-hidden="true" />
            <span>Add owned outfit</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => onSelect('just_trying')} className="rack-capture-intent-option">
            <ScanSearch size={21} aria-hidden="true" />
            <span>Try on outfit</span>
          </DropdownMenu.Item>
          <DropdownMenu.Arrow className="rack-capture-arrow" width={14} height={7} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
