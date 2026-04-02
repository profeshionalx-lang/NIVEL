interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  borderColor?: string;
}

export default function Card({
  children,
  className = "",
  onClick,
  borderColor,
}: CardProps) {
  const interactive = onClick
    ? "cursor-pointer active:scale-[0.97] transition-transform"
    : "";

  return (
    <div
      className={`bg-surface-card rounded-2xl p-4 ${interactive} ${className}`}
      style={borderColor ? { borderTop: `2px solid ${borderColor}` } : undefined}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
