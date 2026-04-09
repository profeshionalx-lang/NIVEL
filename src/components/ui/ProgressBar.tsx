interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: "primary" | "secondary" | "orange";
  label: string;
  sublabel?: string;
}

export default function ProgressBar({
  value,
  max = 10,
  variant = "primary",
  label,
  sublabel,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const barClasses: Record<string, string> = {
    primary: "kinetic-gradient bar-glow-primary",
    secondary: "bg-secondary bar-glow",
    orange: "bg-[#ff9500]",
  };

  const sublabelClasses: Record<string, string> = {
    primary: "kinetic-text",
    secondary: "text-secondary",
    orange: "text-[#ff9500]",
  };

  return (
    <div className="w-full">
      {/* Labels */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-black uppercase tracking-wider text-on-surface">
          {label}
        </span>
        {sublabel && (
          <span className={`text-xs font-bold ${sublabelClasses[variant]}`}>
            {sublabel}
          </span>
        )}
      </div>

      {/* Bar */}
      <div className="h-1.5 w-full rounded-full bg-surface-elevated">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barClasses[variant]}`}
          style={{
            width: `${percentage}%`,
            ...(variant === "orange"
              ? { boxShadow: "0 0 8px rgba(255, 149, 0, 0.5)" }
              : {}),
          }}
        />
      </div>
    </div>
  );
}
