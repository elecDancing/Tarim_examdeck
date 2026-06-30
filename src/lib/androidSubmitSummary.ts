export type AndroidSubmitSummaryOptions = {
  title: string;
  score: number | string;
  correct: number;
  total: number;
  pending?: number;
  detail?: string;
  onReturn: () => void;
};

export function showAndroidSubmitSummary(options: AndroidSubmitSummaryOptions) {
  if (!document.documentElement.classList.contains("native-android")) return;
  document.querySelector(".android-submit-summary-backdrop")?.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "android-submit-summary-backdrop";
  const dialog = document.createElement("section");
  dialog.className = "android-submit-summary-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  const title = document.createElement("span");
  title.className = "android-submit-summary-eyebrow";
  title.textContent = options.title;
  const score = document.createElement("strong");
  score.className = "android-submit-summary-score";
  score.textContent = `${options.score}%`;
  const grid = document.createElement("div");
  grid.className = "android-submit-summary-grid";
  addMetric(grid, "答对", `${options.correct}`);
  addMetric(grid, "总题", `${options.total}`);
  addMetric(grid, "错题", `${Math.max(0, options.total - options.correct - (options.pending ?? 0))}`);
  if (options.pending) addMetric(grid, "未完成", `${options.pending}`);
  const detail = document.createElement("p");
  detail.textContent = options.detail ?? "本次作答已保存。";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary-button wide";
  button.textContent = "返回上一界面";
  button.onclick = () => {
    backdrop.remove();
    options.onReturn();
  };
  dialog.append(title, score, grid, detail, button);
  backdrop.append(dialog);
  document.body.append(backdrop);
}

function addMetric(container: HTMLElement, label: string, value: string) {
  const item = document.createElement("span");
  item.innerHTML = `<em>${label}</em><strong>${value}</strong>`;
  container.append(item);
}
