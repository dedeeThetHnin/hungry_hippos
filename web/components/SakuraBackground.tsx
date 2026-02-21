"use client";

function SakuraFlower({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 5-petal sakura flower */}
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="50"
          cy="30"
          rx="14"
          ry="22"
          stroke="#FF7EB6"
          strokeWidth="1.5"
          fill="#FF7EB6"
          fillOpacity="0.15"
          transform={`rotate(${angle} 50 50)`}
        />
      ))}
      {/* Center */}
      <circle cx="50" cy="50" r="6" fill="#FF7EB6" fillOpacity="0.3" />
    </svg>
  );
}

const flowers = [
  { top: "5%", left: "8%", size: 60, opacity: 0.18, animation: "animate-float", delay: "0s" },
  { top: "12%", left: "75%", size: 45, opacity: 0.14, animation: "animate-float-slow", delay: "2s" },
  { top: "30%", left: "90%", size: 55, opacity: 0.12, animation: "animate-float-slower", delay: "1s" },
  { top: "55%", left: "5%", size: 40, opacity: 0.16, animation: "animate-float-slow", delay: "3s" },
  { top: "70%", left: "80%", size: 50, opacity: 0.1, animation: "animate-float", delay: "4s" },
  { top: "85%", left: "20%", size: 65, opacity: 0.13, animation: "animate-float-slower", delay: "0.5s" },
  { top: "45%", left: "50%", size: 35, opacity: 0.08, animation: "animate-float-slow", delay: "2.5s" },
  { top: "20%", left: "35%", size: 50, opacity: 0.11, animation: "animate-float", delay: "1.5s" },
  { top: "65%", left: "60%", size: 42, opacity: 0.15, animation: "animate-float-slower", delay: "3.5s" },
  { top: "90%", left: "55%", size: 38, opacity: 0.09, animation: "animate-float-slow", delay: "0.8s" },
  { top: "8%", left: "50%", size: 48, opacity: 0.12, animation: "animate-float", delay: "2.2s" },
  { top: "40%", left: "15%", size: 52, opacity: 0.1, animation: "animate-float-slower", delay: "4.2s" },
];

export function SakuraBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {flowers.map((flower, i) => (
        <div
          key={i}
          className={`absolute ${flower.animation}`}
          style={{
            top: flower.top,
            left: flower.left,
            opacity: flower.opacity,
            animationDelay: flower.delay,
          }}
        >
          <SakuraFlower size={flower.size} />
        </div>
      ))}
    </div>
  );
}
