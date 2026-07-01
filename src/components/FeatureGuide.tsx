import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";

export function FeatureGuide({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`feature-guide ${className}`.trim()} role="note">
      <BookOpen size={19} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </section>
  );
}
