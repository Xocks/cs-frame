import { useState } from "react";
import { Star } from "lucide-react";
export function Stars({
  value = 0,
  onChange,
  label = "评分",
  large = false,
}: {
  value?: number;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
  label?: string;
  large?: boolean;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div
      className={`stars ${large ? "large" : ""}`}
      role="group"
      aria-label={label}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${label} ${n} 分`}
          aria-pressed={value === n}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
          className={n <= (hover || value) ? "filled" : ""}
          onClick={(e) => {
            e.stopPropagation();
            onChange(n as 1 | 2 | 3 | 4 | 5);
          }}
        >
          <Star size={large ? 30 : 20} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}
