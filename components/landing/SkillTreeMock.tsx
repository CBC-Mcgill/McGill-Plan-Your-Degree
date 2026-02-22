type NodeState = "completed" | "available" | "locked";

interface Course {
  code: string;
  name: string;
  credits: number;
  state: NodeState;
}

const rows: Course[][] = [
  [
    { code: "COMP 202", name: "Intro to CS",       credits: 3, state: "completed" },
    { code: "COMP 250", name: "Data Structures",   credits: 3, state: "available" },
    { code: "COMP 302", name: "Prog. Languages",   credits: 3, state: "locked"    },
  ],
  [
    { code: "MATH 133", name: "Linear Algebra",    credits: 3, state: "completed" },
    { code: "COMP 251", name: "Algorithms",        credits: 3, state: "available" },
    { code: "COMP 362", name: "Algorithms II",     credits: 3, state: "locked"    },
  ],
];

// Layout constants
const NODE_W   = 124;
const NODE_H   = 64;
const H_GAP    = 52;
const V_GAP    = 40;
const PAD_X    = 24;
const PAD_Y    = 20;
const CANVAS_W = 524;
const CANVAS_H = 208;
const COL_STEP = NODE_W + H_GAP; // 176
const ROW_STEP = NODE_H + V_GAP; // 104
const CP_OFF   = H_GAP / 2;      // 26 — bezier control-point x offset
const BOW      = 8;              // vertical bow on bezier

const nodeLeft  = (col: number) => PAD_X + col * COL_STEP;
const nodeTop   = (row: number) => PAD_Y + row * ROW_STEP;
const portY     = (row: number) => PAD_Y + row * ROW_STEP + NODE_H / 2;
const outPortX  = (col: number) => PAD_X + col * COL_STEP + NODE_W;
const inPortX   = (col: number) => PAD_X + col * COL_STEP;

function bezier(x1: number, x2: number, y: number): string {
  return `M ${x1} ${y} C ${x1 + CP_OFF} ${y - BOW}, ${x2 - CP_OFF} ${y + BOW}, ${x2} ${y}`;
}

function StatusBadge({ state }: { state: NodeState }) {
  if (state === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-wide text-green-700 bg-green-50 rounded px-1.5 py-0.5 whitespace-nowrap">
        ◉ PREREQ MET
      </span>
    );
  }
  if (state === "available") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-wide text-red bg-red-light rounded px-1.5 py-0.5 whitespace-nowrap">
        → READY
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-wide text-zinc-500 bg-zinc-800 rounded px-1.5 py-0.5 whitespace-nowrap">
      ○ LOCKED
    </span>
  );
}

function NodeCard({ course }: { course: Course }) {
  const { code, name, credits, state } = course;

  if (state === "completed") {
    return (
      <div className="w-[124px] h-[64px] rounded-lg overflow-hidden border border-white/10 border-l-2 border-l-green-500 bg-white flex flex-col">
        <div className="px-2.5 pt-2 pb-1 flex-1 min-h-0">
          <div className="font-semibold text-[11px] tracking-tight leading-none text-slate-700 mb-0.5">{code}</div>
          <div className="text-slate-500 text-[9px] leading-snug">{name}</div>
        </div>
        <div className="px-2.5 py-1.5 border-t border-slate-100 flex items-center justify-between">
          <StatusBadge state={state} />
          <span className="text-slate-400 text-[9px]">{credits} cr</span>
        </div>
      </div>
    );
  }

  if (state === "available") {
    return (
      <div
        className="w-[124px] h-[64px] rounded-lg overflow-hidden border border-white/10 border-l-2 border-l-red bg-white flex flex-col"
        style={{ boxShadow: '0 0 0 1px rgba(237,27,47,0.35), 0 4px 20px rgba(237,27,47,0.18)' }}
      >
        <div className="px-2.5 pt-2 pb-1 flex-1 min-h-0">
          <div className="font-semibold text-[11px] tracking-tight leading-none text-red mb-0.5">{code}</div>
          <div className="text-slate-500 text-[9px] leading-snug">{name}</div>
        </div>
        <div className="px-2.5 py-1.5 border-t border-white/5 flex items-center justify-between">
          <StatusBadge state={state} />
          <span className="text-slate-400 text-[9px]">{credits} cr</span>
        </div>
      </div>
    );
  }

  // locked
  return (
    <div className="w-[124px] h-[64px] rounded-lg overflow-hidden border border-zinc-700 border-l-2 border-l-zinc-700 bg-zinc-900 flex flex-col">
      <div className="px-2.5 pt-2 pb-1 flex-1 min-h-0">
        <div className="font-semibold text-[11px] tracking-tight leading-none text-zinc-500 mb-0.5">{code}</div>
        <div className="text-zinc-600 text-[9px] leading-snug">{name}</div>
      </div>
      <div className="px-2.5 py-1.5 border-t border-zinc-800 flex items-center justify-between">
        <StatusBadge state={state} />
        <span className="text-zinc-600 text-[9px]">{credits} cr</span>
      </div>
    </div>
  );
}

export default function SkillTreeMock() {
  return (
    <div className="relative w-full">
      {/* Height compensation: 316 * 0.65 = 205px at mobile, auto at sm+ */}
      <div className="h-[205px] sm:h-auto overflow-hidden sm:overflow-visible">
        {/* Scale shell: pins to top-left, width anchors transform reference */}
        <div className="origin-top-left scale-[0.65] sm:scale-100 w-[524px]">
    <div className="rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl shadow-black/50">

      {/* Browser chrome */}
      <div className="bg-zinc-900 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 bg-zinc-800 rounded-md px-3 py-0.5 text-[11px] text-zinc-400 font-mono text-center">
          app.plan-your-degree.ca / skill-tree
        </div>
        <div className="w-8" />
      </div>

      {/* App toolbar (dark) */}
      <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-semibold text-zinc-300">CS Core Courses</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">Fall 2025</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span>8 / 120 cr</span>
          <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-red rounded-full" style={{ width: "7%" }} />
          </div>
        </div>
      </div>

      {/* Canvas wrapper */}
      <div>
        {/* Fixed-size canvas — dot grid */}
        <div
          className="relative"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            backgroundColor: '#0F0F13',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {/* SVG layer — edges + port circles */}
          <svg
            className="absolute inset-0"
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ zIndex: 0 }}
          >
            {/* Active edges (completed → available) */}
            <path
              d={bezier(outPortX(0), inPortX(1), portY(0))}
              stroke="#4ADE80"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="6 4"
              style={{ animation: 'flowDash 0.7s linear infinite', animationDelay: '0s' }}
            />
            <path
              d={bezier(outPortX(0), inPortX(1), portY(1))}
              stroke="#4ADE80"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="6 4"
              style={{ animation: 'flowDash 0.7s linear infinite', animationDelay: '0.35s' }}
            />

            {/* Inactive edges (available → locked) */}
            <path
              d={bezier(outPortX(1), inPortX(2), portY(0))}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="3 4"
            />
            <path
              d={bezier(outPortX(1), inPortX(2), portY(1))}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="3 4"
            />

            {/* Port circles — row 0 */}
            {/* completed output — hollow green */}
            <circle cx={outPortX(0)} cy={portY(0)} r="4" fill="#0F0F13" stroke="#4ADE80" strokeWidth="1.5" />
            {/* available input — solid green */}
            <circle cx={inPortX(1)}  cy={portY(0)} r="4" fill="#4ADE80" stroke="#4ADE80" strokeWidth="1.5" />
            {/* available output — dim hollow */}
            <circle cx={outPortX(1)} cy={portY(0)} r="4" fill="#0F0F13" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
            {/* locked input — dashed dim */}
            <circle cx={inPortX(2)}  cy={portY(0)} r="4" fill="#0F0F13" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="2 2" />

            {/* Port circles — row 1 */}
            <circle cx={outPortX(0)} cy={portY(1)} r="4" fill="#0F0F13" stroke="#4ADE80" strokeWidth="1.5" />
            <circle cx={inPortX(1)}  cy={portY(1)} r="4" fill="#4ADE80" stroke="#4ADE80" strokeWidth="1.5" />
            <circle cx={outPortX(1)} cy={portY(1)} r="4" fill="#0F0F13" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
            <circle cx={inPortX(2)}  cy={portY(1)} r="4" fill="#0F0F13" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="2 2" />
          </svg>

          {/* Node cards — absolutely positioned */}
          {rows.map((row, ri) =>
            row.map((course, ci) => (
              <div
                key={`${ri}-${ci}`}
                className="absolute"
                style={{ left: nodeLeft(ci), top: nodeTop(ri), zIndex: 10 }}
              >
                <NodeCard course={course} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Status bar (dark) */}
      <div className="bg-zinc-950 border-t border-zinc-800 px-4 py-2 flex items-center gap-5">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          2 completed
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <div className="w-1.5 h-1.5 rounded-full bg-red" />
          2 available
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          2 locked
        </div>
        <div className="ml-auto text-[10px] text-zinc-500 font-mono">
          AI ready ✦
        </div>
      </div>

    </div>
        </div>
      </div>

      {/* Bottom gradient — blends mock into page on mobile only */}
      <div
        className="absolute inset-x-0 bottom-0 h-12 sm:hidden pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--color-background))' }}
      />
    </div>
  );
}
