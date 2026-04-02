interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export default function Button({
  children,
  variant = "primary",
  className = "",
  onClick,
  disabled = false,
  type = "button",
}: ButtonProps) {
  const base = "transition-all duration-200";

  const variants: Record<string, string> = {
    primary:
      "kinetic-gradient text-on-primary font-black py-4 rounded-2xl w-full shadow-[0_0_20px_rgba(202,253,0,0.3)]",
    secondary:
      "border border-border text-on-surface font-semibold py-3 rounded-xl",
    ghost:
      "text-primary text-sm font-bold uppercase tracking-wider",
  };

  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${disabledClass} ${className}`}
    >
      {children}
    </button>
  );
}
