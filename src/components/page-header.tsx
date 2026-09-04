import type { LucideIcon } from "lucide-react";

export function PageHeader({
  icon: Icon,
  title,
  eyebrow,
  action,
  centered = false,
}: {
  icon: LucideIcon;
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <header className={`app-page-header ${centered ? "is-centered" : ""}`}>
      <div className="app-page-header__titleWrap">
        <span className="app-page-header__icon"><Icon size={19} strokeWidth={2.2} /></span>
        <div className="min-w-0">
          {eyebrow && <p className="app-page-header__eyebrow">{eyebrow}</p>}
          <h1 className="app-page-header__title">{title}</h1>
        </div>
      </div>
      {action && <div className="app-page-header__action">{action}</div>}
    </header>
  );
}
