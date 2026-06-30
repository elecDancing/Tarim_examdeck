import { BarChart3, LayoutGrid, Menu, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { ExamSession, Question } from "../types";

export function ResultSummary({ session, questionById }: { session: ExamSession; questionById: Map<string, Question> }) {
  const wrongItems = session.items.filter((item) => item.isCorrect === false);
  return (
    <section className="result-panel">
      <h2>成绩 {session.score}%</h2>
      <p>{session.items.length - wrongItems.length} 对 / {wrongItems.length} 错</p>
      <div className="wrong-mini-list">
        {wrongItems.slice(0, 8).map((item) => {
          const question = questionById.get(item.questionId);
          return question ? <span key={item.questionId}>{question.uid}</span> : null;
        })}
      </div>
    </section>
  );
}

export function AnswerProgressToggle({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (value: boolean) => void }) {
  const isAndroid = document.documentElement.classList.contains("native-android");
  return (
    <button
      className="progress-toggle-button"
      type="button"
      onClick={() => setCollapsed(!collapsed)}
      aria-pressed={collapsed}
      aria-label={collapsed ? "展开答题进度" : "收起答题进度"}
      title={collapsed ? "展开答题进度" : "收起答题进度"}
    >
      {isAndroid ? <LayoutGrid size={20} /> : collapsed ? <PanelRightOpen size={22} /> : <PanelRightClose size={22} />}
    </button>
  );
}

export function AnswerNavToggle({ openSidebar }: { openSidebar: () => void }) {
  return (
    <button className="focus-nav-fab is-visible" type="button" onClick={openSidebar} aria-label="展开导航" title="展开导航">
      <Menu size={22} />
    </button>
  );
}

export function RecentSessions({ sessions }: { sessions: ExamSession[] }) {
  return (
    <section className="recent-panel">
      <div className="section-title">
        <h2>最近考试</h2>
        <BarChart3 size={18} />
      </div>
      <div className="session-list">
        {sessions.slice(0, 8).map((session, index) => (
          <div className="session-row" key={`${session.id}-${session.submittedAt ?? session.startedAt}-${index}`}>
            <span>{new Date(session.startedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            <strong>{session.score}%</strong>
            <em>{session.items.length} 题</em>
          </div>
        ))}
        {sessions.length === 0 && <p className="empty-text">暂无考试记录</p>}
      </div>
    </section>
  );
}
