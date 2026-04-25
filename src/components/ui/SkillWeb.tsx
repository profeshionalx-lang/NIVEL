interface SkillWebSlice {
  label: string;
  value: number; // 0..max
}

interface Props {
  slices: SkillWebSlice[]; // expected length 8
  max?: number;
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 120;
const RINGS = 5;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}

function wedgePath(angleStart: number, angleEnd: number, rOuter: number) {
  if (rOuter <= 0) return "";
  const [x1, y1] = polar(CENTER, CENTER, rOuter, angleStart);
  const [x2, y2] = polar(CENTER, CENTER, rOuter, angleEnd);
  const largeArc = angleEnd - angleStart > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export default function SkillWeb({ slices, max = 10 }: Props) {
  const n = slices.length;
  const sliceAngle = 360 / n;
  const labelR = RADIUS + 26;

  return (
    <div className="relative w-full flex items-center justify-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[340px]"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="skill-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#cafd00" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#00f4fe" stopOpacity="0.7" />
          </radialGradient>
        </defs>

        {/* Background concentric rings */}
        {Array.from({ length: RINGS }).map((_, i) => {
          const r = (RADIUS * (i + 1)) / RINGS;
          return (
            <circle
              key={i}
              cx={CENTER}
              cy={CENTER}
              r={r}
              fill="none"
              stroke="#262626"
              strokeWidth={1}
            />
          );
        })}

        {/* Spokes */}
        {Array.from({ length: n }).map((_, i) => {
          const a = i * sliceAngle;
          const [x, y] = polar(CENTER, CENTER, RADIUS, a);
          return (
            <line
              key={`spoke-${i}`}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke="#262626"
              strokeWidth={1}
            />
          );
        })}

        {/* Filled wedges per skill */}
        {slices.map((s, i) => {
          const start = i * sliceAngle - sliceAngle / 2;
          const end = start + sliceAngle;
          const ratio = Math.max(0, Math.min(1, s.value / max));
          const r = RADIUS * ratio;
          if (r <= 0) return null;
          return (
            <path
              key={`wedge-${i}`}
              d={wedgePath(start, end, r)}
              fill="url(#skill-fill)"
              stroke="#cafd00"
              strokeOpacity={0.4}
              strokeWidth={1}
            />
          );
        })}

        {/* Labels */}
        {slices.map((s, i) => {
          const a = i * sliceAngle;
          const [x, y] = polar(CENTER, CENTER, labelR, a);
          const filled = s.value > 0;
          return (
            <text
              key={`label-${i}`}
              x={x}
              y={y}
              fill={filled ? "#ffffff" : "#767575"}
              fontSize={10}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              {s.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
