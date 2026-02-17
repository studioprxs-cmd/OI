import Link from "next/link";
import { ReactNode } from "react";

type LayoutProps = { children: ReactNode };

export function PageContainer({ children }: LayoutProps) {
  return <main className="page-container">{children}</main>;
}

export function OiBadge({ label = "OI" }: { label?: string }) {
  return (
    <span className="oi-badge" aria-label={`${label} 브랜드 배지`}>
      <span className="oi-badge-dot" aria-hidden />
      {label}
    </span>
  );
}

export function Card({ children }: LayoutProps) {
  return <section className="card">{children}</section>;
}

export function SectionTitle({ children }: LayoutProps) {
  return <h2 className="section-title">{children}</h2>;
}

type AdminTabItem = {
  href: string;
  label: string;
  badge?: number;
  active?: boolean;
};

export function AdminSectionTabs({ items }: { items: AdminTabItem[] }) {
  return (
    <nav className="admin-section-tabs" aria-label="관리자 섹션 이동">
      {items.map((item) => (
        <Link key={`${item.href}-${item.label}`} href={item.href} className={`admin-section-tab${item.active ? " is-active" : ""}`}>
          <span>{item.label}</span>
          {typeof item.badge === "number" ? <span className="admin-section-tab-badge">{item.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

type AppStateCardProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  actions?: ReactNode;
};

export function AppStateCard({ eyebrow, title, description, tone = "neutral", actions }: AppStateCardProps) {
  return (
    <section className={`app-state-card app-state-card-${tone}`}>
      {eyebrow ? <p className="app-state-eyebrow">{eyebrow}</p> : null}
      <h2 className="app-state-title">{title}</h2>
      {description ? <p className="app-state-description">{description}</p> : null}
      {actions ? <div className="app-state-actions">{actions}</div> : null}
    </section>
  );
}

type StatePanelProps = {
  title: ReactNode;
  description?: ReactNode;
  tone?: "neutral" | "success" | "warning";
  actions?: ReactNode;
};

export function StatePanel({ title, description, tone = "neutral", actions }: StatePanelProps) {
  return (
    <section className={`state-panel state-panel-${tone}`}>
      <div className="state-panel-head">
        <h3 className="state-panel-title">{title}</h3>
        {description ? <p className="state-panel-description">{description}</p> : null}
      </div>
      {actions ? <div className="state-panel-actions">{actions}</div> : null}
    </section>
  );
}

type ButtonProps = {
  type?: "button" | "submit";
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
};

export function Button({ type = "button", children, disabled, onClick, variant = "primary", className }: ButtonProps) {
  return (
    <button type={type} className={`btn btn-${variant}${className ? ` ${className}` : ""}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

type InputProps = {
  id: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  min?: number;
  step?: number;
};

export function InputField({ id, name, type = "text", value, onChange, placeholder, required, min, step }: InputProps) {
  return (
    <input
      className="input"
      id={id}
      name={name}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      min={min}
      step={step}
    />
  );
}

type SelectOption = { value: string; label: string };

type SelectProps = {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
};

export function SelectField({ id, name, value, onChange, options }: SelectProps) {
  return (
    <select className="input" id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

type TextAreaProps = {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
};

export function TextAreaField({ id, name, value, onChange, placeholder, rows = 4, required }: TextAreaProps) {
  return (
    <textarea
      className="input"
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      required={required}
    />
  );
}

type FieldProps = { label: string; htmlFor: string; children: ReactNode };

export function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <label className="field" htmlFor={htmlFor}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

type PillProps = { children: ReactNode; tone?: "neutral" | "success" | "danger" };

export function Pill({ children, tone = "neutral" }: PillProps) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

type MessageProps = { text: string; tone?: "info" | "error" };

export function Message({ text, tone = "info" }: MessageProps) {
  return (
    <p
      className={`message message-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      {text}
    </p>
  );
}

type TextLinkProps = { href: string; children: ReactNode };

export function TextLink({ href, children }: TextLinkProps) {
  return (
    <Link className="text-link" href={href}>
      {children}
    </Link>
  );
}
