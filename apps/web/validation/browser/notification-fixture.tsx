import { useState } from "react";
import { useNotifications } from "../../src/components/Notifications";
import TaskSheet from "../../src/components/TaskSheet";
import { Dialog, DialogContent, DialogTitle } from "../../src/components/ui/dialog";

/** Real modal/notice components; only the outcomes are synthetic. */
export default function NotificationFixture() {
  const { notify } = useNotifications();
  const [open, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  const [undone, setUndone] = useState(false);
  const actions = <>
    <button onClick={() => notify({ message: "Piece added." })}>Success notice</button>
    <button onClick={() => notify({ message: "Could not save this photo. Try again.", error: true })}>Error notice</button>
    <button onClick={() => notify({ message: "Piece removed.", action: { label: "Undo", onClick: () => setUndone(true) } })}>Undo notice</button>
  </>;
  return <main className="p-5 space-y-4">
    {actions}
    <button onClick={() => setOpen(true)}>Open task</button>
    <p>{undone ? "Removal undone." : "Removal not undone."}</p>
    <TaskSheet open={open} onOpenChange={setOpen} title="Synthetic task" footer={<button onClick={() => setOpen(false)}>Back to wardrobe</button>}>
      {actions}
      <button onClick={() => setNested(true)}>Open nested dialog</button>
      <Dialog open={nested} onOpenChange={setNested}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Synthetic confirmation</DialogTitle>
          <button onClick={() => setNested(false)}>Back to task</button>
        </DialogContent>
      </Dialog>
    </TaskSheet>
  </main>;
}
