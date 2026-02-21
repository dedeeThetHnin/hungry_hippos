"use client";

import { useId } from "react";

function SakuraFlower({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  const rid = useId();
  const id = `sakura-${rid.replace(/:/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient
          id={`${id}-petal`}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(50 28) rotate(90) scale(28 22)"
        >
          <stop offset="0" stopColor="#FFD1E8" stopOpacity="1" />
          <stop offset="0.55" stopColor="#FF4FA6" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FF1F87" stopOpacity="0.9" />
        </radialGradient>

        {/* Glow */}
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="1.8"
            floodColor="#FF4FA6"
            floodOpacity="0.55"
          />
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="4.5"
            floodColor="#FF1F87"
            floodOpacity="0.25"
          />
        </filter>

        <radialGradient
          id={`${id}-center`}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(50 50) rotate(90) scale(10)"
        >
          <stop offset="0" stopColor="#FFF0F8" stopOpacity="1" />
          <stop offset="0.6" stopColor="#FF5FB0" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FF1F87" stopOpacity="0.9" />
        </radialGradient>
      </defs>

      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="50"
          cy="30"
          rx="14"
          ry="22"
          fill={`url(#${id}-petal)`}
          opacity={0.85}
          stroke="#FF1F87"
          strokeOpacity={0.75}
          strokeWidth="1.6"
          filter={`url(#${id}-glow)`}
          transform={`rotate(${angle} 50 50)`}
        />
      ))}

      <circle
        cx="50"
        cy="50"
        r="6.5"
        fill={`url(#${id}-center)`}
        opacity={0.95}
        filter={`url(#${id}-glow)`}
      />
    </svg>
  );
}

type Flower = {
  left: string;
  size: number;
  opacity: number;
  delay: string;
  duration: string;
  drift: number; // px
};

const flowers = [
  {
    left: "8%",
    size: 60,
    opacity: 0.18,
    delay: "0s",
    duration: "14s",
    drift: -40,
    start: 5,
  },
  {
    left: "75%",
    size: 45,
    opacity: 0.14,
    delay: "2s",
    duration: "12s",
    drift: 30,
    start: 22,
  },
  {
    left: "90%",
    size: 55,
    opacity: 0.12,
    delay: "1s",
    duration: "16s",
    drift: 55,
    start: 40,
  },
  {
    left: "5%",
    size: 40,
    opacity: 0.16,
    delay: "3s",
    duration: "13s",
    drift: -25,
    start: 12,
  },
  {
    left: "80%",
    size: 50,
    opacity: 0.1,
    delay: "4s",
    duration: "15s",
    drift: 40,
    start: 65,
  },
  {
    left: "20%",
    size: 65,
    opacity: 0.13,
    delay: "0.5s",
    duration: "18s",
    drift: -60,
    start: 78,
  },
  {
    left: "50%",
    size: 35,
    opacity: 0.08,
    delay: "2.5s",
    duration: "11s",
    drift: 20,
    start: 30,
  },
  {
    left: "35%",
    size: 50,
    opacity: 0.11,
    delay: "1.5s",
    duration: "17s",
    drift: -35,
    start: 50,
  },
  {
    left: "60%",
    size: 42,
    opacity: 0.15,
    delay: "3.5s",
    duration: "14s",
    drift: 45,
    start: 10,
  },
  {
    left: "55%",
    size: 38,
    opacity: 0.09,
    delay: "0.8s",
    duration: "12.5s",
    drift: -15,
    start: 88,
  },
  {
    left: "50%",
    size: 48,
    opacity: 0.12,
    delay: "2.2s",
    duration: "16.5s",
    drift: 25,
    start: 58,
  },
  {
    left: "15%",
    size: 52,
    opacity: 0.1,
    delay: "4.2s",
    duration: "19s",
    drift: -50,
    start: 35,
  },
];

export function SakuraBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Embedded global CSS for the fall animation */}
      <style jsx global>{`
        @keyframes sakura-fall {
          0% {
            transform: translate3d(0, -15vh, 0) rotate(0deg);
          }
          20% {
            transform: translate3d(calc(var(--sakura-drift) * 0.4), 10vh, 0)
              rotate(60deg);
          }
          50% {
            transform: translate3d(calc(var(--sakura-drift) * 1), 55vh, 0)
              rotate(160deg);
          }
          80% {
            transform: translate3d(calc(var(--sakura-drift) * 0.6), 90vh, 0)
              rotate(260deg);
          }
          100% {
            transform: translate3d(0, 115vh, 0) rotate(340deg);
          }
        }

        .sakura-fall {
          top: -20vh;
          will-change: transform;
          animation-name: sakura-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>

      {flowers.map((flower, i) => (
        <div
          key={i}
          className="absolute sakura-fall"
          style={
            {
              left: flower.left,
              opacity: flower.opacity,
              animationDelay: flower.delay,
              animationDuration: flower.duration,
              ["--sakura-drift" as any]: `${flower.drift}px`,
            } as React.CSSProperties
          }
        >
          <SakuraFlower size={flower.size} />
        </div>
      ))}
    </div>
  );
}
