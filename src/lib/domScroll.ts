export function scrollElementToTop(element: HTMLElement | null) {
  try {
    element?.scrollTo?.({ top: 0, behavior: "auto" });
  } catch {
    // jsdom does not implement element scrolling; real browsers do.
  }
}

export function scrollWindowToTop() {
  try {
    if (navigator.userAgent.includes("jsdom")) return;
    window.scrollTo?.({ top: 0, behavior: "auto" });
  } catch {
    // jsdom does not implement window scrolling; real browsers do.
  }
}
