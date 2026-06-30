import { useEffect } from "react";
import { XCircle } from "lucide-react";

type CopyrightDialogProps = {
  onClose: () => void;
  backShortcutLabel: string;
  shortcutModifierLabel: string;
};

export function CopyrightDialog({ onClose, backShortcutLabel, shortcutModifierLabel }: CopyrightDialogProps) {
  const isAndroid = document.documentElement.classList.contains("native-android");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <article
        className="copyright-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="版权介绍"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={isAndroid ? onClose : undefined}
      >
        <header className="detail-header">
          <div>
            <span className="eyebrow">关于 / 反馈</span>
            <h2>塔里木刷题王</h2>
          </div>
          {!isAndroid && (
            <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
              <XCircle size={20} />
            </button>
          )}
        </header>
        <div className="copyright-content">
          <div className="copyright-info-grid">
            <div className="copyright-stack">
              <section>
                <h3>版权与使用说明</h3>
                <p>本软件为个人学习与内部备考辅助工具，所有功能完全免费。</p>
                <p>请勿反编译、爬取题库、批量复制题库内容，或将本软件及题库用于商业售卖、公开传播和二次分发。</p>
              </section>
              <section>
                <h3>使用范围</h3>
                <p>请勿将本软件及题库内容用于商业售卖、公开传播、二次分发或其他侵犯权利人权益的用途。</p>
                <p>如题库内容存在版权争议，应以权利人要求为准，及时删除或替换相关资料。</p>
              </section>
              <section>
                <h3>数据说明</h3>
                <p>学习记录、错题、笔记、熟练度和复习预测均保存在本机设备中。</p>
                <p>如需在多台设备之间同步，可在“设置”中导出学习进度，再到其他设备导入。</p>
              </section>
            </div>
            <div className="copyright-stack">
              <section className="copyright-contact-card">
                <h3>Bug 反馈与联系</h3>
                <div className="contact-row"><strong>作者邮箱</strong><span>lu3na1r9iv8e@icloud.com</span></div>
                <div className="contact-row"><strong>微信</strong><span>扫码添加作者，备注“题库导入”或“Bug 反馈”。</span></div>
                <p className="import-service-callout">
                  题库导入帮助：找书 <strong>5r/本</strong>，个性化题库导入 <strong>5r/500 道客观题</strong>。
                </p>
              </section>
              {!isAndroid && (
                <section>
                  <h3>快捷键说明</h3>
                  <div className="shortcut-list">
                    <span><strong>1 / 2 / 3 / 4</strong>选择对应选项</span>
                    <span><strong>空格</strong>多选确认或进入下一题</span>
                    <span><strong>{backShortcutLabel} + Z</strong>返回上一题</span>
                    <span><strong>{shortcutModifierLabel} + 1</strong>收藏 / 取消收藏</span>
                    <span><strong>{shortcutModifierLabel} + 4</strong>斩题 / 取消斩题</span>
                    <span><strong>{shortcutModifierLabel} + 5</strong>加入 / 移出重难题库</span>
                  </div>
                </section>
              )}
            </div>
          </div>
          <section>
            <h3>支持作者</h3>
            <p>如果这个软件有帮到您，不妨打赏给作者加个鸡腿！</p>
          </section>
          <div className="support-qr-grid">
            <section className="support-qr-card">
              <div className="support-qr-title">
                <h3>微信联系作者</h3>
                <span>题库导入 / Bug 反馈</span>
              </div>
              <img src="/contact/author-wechat.png" alt="作者微信二维码" />
              <p>扫码添加作者微信</p>
            </section>
            <section className="support-qr-card">
              <div className="support-qr-title">
                <h3>打赏支持</h3>
              </div>
              <img src="/contact/wechat-pay.png" alt="微信支付打赏码" />
              <p>觉得好用可以打赏一下作者，非常感谢！</p>
            </section>
          </div>
          <div className="copyright-footnote">
            <p>Powered by NiDiPengShao</p>
          </div>
        </div>
      </article>
    </div>
  );
}
