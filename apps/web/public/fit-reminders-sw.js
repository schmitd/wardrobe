/* No page caching or private content storage. This worker handles generic push only. */
self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data?.json();
  } catch {
    return;
  }
  if (
    data?.version !== 1 ||
    typeof data.reminderId !== "string" ||
    !/^[a-z0-9]{20,64}$/.test(data.reminderId) ||
    !Number.isFinite(data.expiresAt) ||
    data.expiresAt <= Date.now()
  )
    return;
  event.waitUntil(
    self.registration.showNotification("Time for a fit check", {
      body: "Capture what you're wearing today.",
      tag: data.reminderId,
      data: { reminderId: data.reminderId },
      icon: "/icon.png",
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const id = event.notification.data?.reminderId;
  if (typeof id !== "string" || !/^[a-z0-9]{20,64}$/.test(id)) return;
  event.waitUntil(
    self.clients.openWindow(`/fits?reminder=${encodeURIComponent(id)}`),
  );
});
