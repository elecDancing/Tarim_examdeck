import { useLayoutEffect, useRef, useState } from "react";
import type { DailyStudyStat } from "../types";
import { buildStudyHeatmap, formatPercent, formatStudyDate } from "../lib/appRules";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

type HeatmapDay = ReturnType<typeof buildStudyHeatmap>["days"][number];

export function HomeStudyStats({ dailyStats }: { dailyStats: Record<string, DailyStudyStat> }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [preview, setPreview] = useState<{
    date: string;
    answered: number;
    correct: number;
    wrong: number;
    x: number;
    y: number;
  } | null>(null);
  const year = new Date().getFullYear();
  const heatmap = buildStudyHeatmap(dailyStats, year);
  const yearlyAnswered = heatmap.days.reduce((sum, day) => sum + day.stat.answered, 0);

  useLayoutEffect(() => {
    const timer = window.setTimeout(() => {
      const scroller = scrollRef.current;
      const today = scroller?.querySelector<HTMLElement>(".activity-cell.today");
      if (!scroller || !today) return;
      const targetLeft = today.offsetLeft - Math.max(0, (scroller.clientWidth - today.offsetWidth) / 2);
      scroller.scrollLeft = Math.max(0, targetLeft);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [year, heatmap.weekCount]);

  function showPreview(day: HeatmapDay, cell: HTMLElement) {
    const panel = panelRef.current;
    if (!panel) return;
    const panelRect = panel.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    setPreview({
      date: day.date,
      answered: day.stat.answered,
      correct: day.stat.correct,
      wrong: day.stat.wrong,
      x: Math.min(panelRect.width - 78, Math.max(78, cellRect.left + cellRect.width / 2 - panelRect.left)),
      y: Math.max(38, cellRect.top - panelRect.top - 10)
    });
  }

  return (
    <section className="study-calendar-panel" ref={panelRef}>
      <div className="heatmap-head">
        <span>年度刷题热力图</span>
        <em>今年累计 {yearlyAnswered.toLocaleString("zh-CN")} 题</em>
      </div>
      <div className="activity-calendar" aria-label={`${year} 年每日刷题量`}>
        <div className="weekday-labels" aria-hidden="true">
          {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="activity-scroll" ref={scrollRef}>
          <div className="activity-grid" style={{ gridTemplateColumns: `repeat(${heatmap.weekCount}, 13px)` }}>
            {heatmap.days.map((day) => (
              <button
                key={day.date}
                type="button"
                className={`activity-cell level-${day.level}${day.isToday ? " today" : ""}`}
                style={{ gridColumn: day.weekIndex + 1, gridRow: day.weekday + 1 }}
                title={`${formatStudyDate(day.date)}：刷题 ${day.stat.answered}，正确 ${day.stat.correct}，错误 ${day.stat.wrong}`}
                aria-label={`${formatStudyDate(day.date)}刷题 ${day.stat.answered} 题`}
                onPointerDown={(event) => showPreview(day, event.currentTarget)}
                onPointerUp={() => setPreview(null)}
                onPointerCancel={() => setPreview(null)}
                onPointerLeave={() => setPreview(null)}
                onTouchStart={(event) => showPreview(day, event.currentTarget)}
                onTouchEnd={() => setPreview(null)}
                onTouchCancel={() => setPreview(null)}
              />
            ))}
          </div>
        </div>
      </div>
      {preview && (
        <div className="activity-tooltip" role="status" style={{ left: preview.x, top: preview.y }}>
          <strong>{formatStudyDate(preview.date)}</strong>
          <span>刷题 {preview.answered} 题 · 正确率 {formatPercent(preview.correct, preview.answered)}</span>
        </div>
      )}
    </section>
  );
}
