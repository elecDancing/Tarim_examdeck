export type AndroidSubmitSummaryOptions = {
  title: string;
  score: number | string;
  correct: number;
  total: number;
  pending?: number;
  detail?: string;
  primaryLabel?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
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
  const actions = document.createElement("div");
  actions.className = options.secondaryAction ? "android-submit-summary-actions" : "android-submit-summary-actions single";
  if (options.secondaryAction) {
    const secondary = document.createElement("button");
    secondary.type = "button";
    secondary.className = "secondary-button wide";
    secondary.textContent = options.secondaryAction.label;
    secondary.onclick = () => {
      backdrop.remove();
      options.secondaryAction?.onClick();
    };
    actions.append(secondary);
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary-button wide";
  button.textContent = options.primaryLabel ?? "返回上一界面";
  button.onclick = () => {
    backdrop.remove();
    options.onReturn();
  };
  actions.append(button);
  dialog.append(title, score, grid, detail, actions);
  backdrop.append(dialog);
  document.body.append(backdrop);
}

export function showAndroidConfirmDialog(options: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}) {
  if (!document.documentElement.classList.contains("native-android")) return Promise.resolve(window.confirm(options.message));
  document.querySelector(".android-submit-summary-backdrop")?.remove();

  return new Promise<boolean>((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "android-submit-summary-backdrop";
    const dialog = document.createElement("section");
    dialog.className = "android-submit-summary-dialog android-confirm-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const title = document.createElement("span");
    title.className = "android-submit-summary-eyebrow";
    title.textContent = options.title;
    const message = document.createElement("p");
    message.className = "android-confirm-message";
    message.textContent = options.message;
    const actions = document.createElement("div");
    actions.className = "android-submit-summary-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary-button wide";
    cancel.textContent = options.cancelLabel ?? "取消";
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = options.danger ? "danger-button wide" : "primary-button wide";
    confirm.textContent = options.confirmLabel ?? "确认";
    cancel.onclick = () => { backdrop.remove(); resolve(false); };
    confirm.onclick = () => { backdrop.remove(); resolve(true); };
    actions.append(cancel, confirm);
    dialog.append(title, message, actions);
    backdrop.append(dialog);
    document.body.append(backdrop);
  });
}

function addMetric(container: HTMLElement, label: string, value: string) {
  const item = document.createElement("span");
  item.innerHTML = `<em>${label}</em><strong>${value}</strong>`;
  container.append(item);
}
