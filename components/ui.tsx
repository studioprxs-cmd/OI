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

type ButtonProps = {
  type?: "button" | "submit";
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
};

export function Button({ type = "button", children, disabled, onClick }: ButtonProps) {
  return (
    <button type={type} className="btn" disabled={disabled} onClick={onClick}>
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
