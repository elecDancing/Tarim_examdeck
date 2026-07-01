import { useEffect } from "react";
import { LogOut, Save, XCircle } from "lucide-react";

type DesktopCloseConfirmDialogProps = {
  onSaveAndQuit: () => void;
  onCancel: () => void;
};

export function DesktopCloseConfirmDialog({ onSaveAndQuit, onCancel }: DesktopCloseConfirmDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-backdrop desktop-close-backdrop" onMouseDown={onCancel}>
      <article className="desktop-close-dialog" role="dialog" aria-modal="true" aria-label="退出前保存刷题进度" onMouseDown={(event) => event.stopPropagation()}>
        <header className="desktop-close-header">
          <span className="desktop-close-icon">
            <Save size={24} strokeWidth={2.4} />
          </span>
          <div>
            <span className="eyebrow">正在刷题</span>
            <h2>保存当前进度后退出？</h2>
          </div>
          <button className="icon-button" type="button" aria-label="继续刷题" onClick={onCancel}>
            <XCircle size={20} />
          </button>
        </header>
        <p className="desktop-close-copy">
          保存后，下次打开会从当前题目和已判定记录继续；取消退出则保留在当前刷题界面。
        </p>
        <div className="desktop-close-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>继续刷题</button>
          <button className="primary-button" type="button" onClick={onSaveAndQuit}>
            <LogOut size={18} />
            保存并退出
          </button>
        </div>
      </article>
    </div>
  );
}
