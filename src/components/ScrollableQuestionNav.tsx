import { useEffect, useRef } from "react";

type ScrollableQuestionNavItem = {
  key: string;
  className: string;
};

function scrollToTop(container: HTMLDivElement, top: number) {
  if (typeof container.scrollTo === "function") {
    container.scrollTo({ top, behavior: "smooth" });
  } else {
    container.scrollTop = top;
  }
}

export function ScrollableQuestionNav({
  items,
  currentIndex,
  onSelect,
  className = ""
}: {
  items: ScrollableQuestionNavItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      const current = container?.querySelector<HTMLElement>(`[data-question-index="${currentIndex}"]`);
      if (!container || !current) return;
      const padding = 12;
      const currentTop = current.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      const currentBottom = currentTop + current.offsetHeight;
      const visibleTop = container.scrollTop + padding;
      const visibleBottom = container.scrollTop + container.clientHeight - padding;
      if (currentTop < visibleTop) {
        scrollToTop(container, Math.max(0, currentTop - padding));
      } else if (currentBottom > visibleBottom) {
        scrollToTop(container, currentBottom - container.clientHeight + padding);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentIndex, items.length]);

  return (
    <div ref={containerRef} className={`nav-grid scrollable-nav-grid ${className}`.trim()} aria-label="可滚动题号导航">
      {items.map((item, index) => (
        <button
          key={item.key}
          className={item.className}
          data-question-index={index}
          onClick={() => onSelect(index)}
          type="button"
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}
