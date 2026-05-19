interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: "primary" | "secondary" | "orange";
  label: string;
  sublabel?: string;
  delta?: number;
  isNew?: boolean;
}

export default function ProgressBar({
  value,
  max = 10,
  variant = "primary",
  label,
  sublabel,
  delta,
  isNew,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const prevPercentage = delta ? Math.min(100, Math.max(0, ((value - delta) / max) * 100)) : percentage;
  const hasDelta = !!(delta && delta > 0);

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
          {isNew && !hasDelta && (
            <span
              className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-widest leading-none"
              style={{ backgroundColor: "#cafd00", color: "#0a0a0a" }}
            >
              NEW
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {sublabel && (
            <span className={`text-xs font-bold ${sublabelClasses[variant]}`}>
              {sublabel}
            </span>
          )}
          {hasDelta && (
            <span
              className="delta-badge-pop inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black leading-none"
              style={{ backgroundColor: "#cafd00", color: "#0a0a0a" }}
            >
              +{delta}
            </span>
          )}
        </div>
      </div>

      {/* Bar */}
      <div className="h-1.5 w-full rounded-full bg-surface-elevated relative overflow-hidden">
        {/* Dimmed delta — full reach (0 → percentage), reduced opacity.
            The track clip handles rounding; the solid base on top draws over
            the "old" portion, so the seam is exactly the base's right edge. */}
        {hasDelta && (
          <div
            className={`absolute inset-y-0 left-0 h-full transition-all duration-500 ${barClasses[variant]}`}
            style={{
              width: `${percentage}%`,
              opacity: 0.35,
            }}
          />
        )}
        {/* Solid base — "old" progress, drawn on top of the dimmed layer.
            No per-side radius needed: it stops mid-bar with a clean straight
            edge, and the track's overflow-hidden rounds the outer ends. */}
        <div
          className={`absolute inset-y-0 left-0 h-full transition-all duration-500 ${barClasses[variant]}`}
          style={{
            width: `${hasDelta ? prevPercentage : percentage}%`,
          }}
        />
      </div>
    </div>
  );
}
