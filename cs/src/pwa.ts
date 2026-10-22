export function registerOfflineCache() {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol))
    return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        const notify = () => {
          if (reg.active)
            window.dispatchEvent(new Event("frame-offline-ready"));
        };
        if (reg.active) notify();
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "activated") notify();
          });
        });
        navigator.serviceWorker.addEventListener("message", (e) => {
          if (e.data === "frame-offline-ready") notify();
        });
      })
      .catch(() => window.dispatchEvent(new Event("frame-offline-failed")));
  });
}
