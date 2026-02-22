const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="4"  cy="11" r="2.5" />
        <circle cx="11" cy="4"  r="2.5" />
        <circle cx="18" cy="11" r="2.5" />
        <circle cx="11" cy="18" r="2.5" />
        <line x1="6.4"  y1="9.5"  x2="8.6"  y2="6.4"  />
        <line x1="13.4" y1="6.4"  x2="15.6" y2="9.5"  />
        <line x1="15.6" y1="12.5" x2="13.4" y2="15.6" />
        <line x1="8.6"  y1="15.6" x2="6.4"  y2="12.5" />
      </svg>
    ),
    title: "Prerequisite Skill Tree",
    description:
      "Visualize the full CS and Engineering prerequisite graph. See every dependency at a glance — no more guessing what unlocks what.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 14a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 9h6M8 13h4" />
      </svg>
    ),
    title: "AI Course Advisor",
    description:
      "Powered by Claude. Ask anything — which courses to take next, how to balance workload, what a career in ML actually requires.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="18" height="17" rx="2" />
        <line x1="2" y1="8"  x2="20" y2="8"  />
        <line x1="8" y1="3"  x2="8"  y2="8"  />
        <line x1="14" y1="3" x2="14" y2="8"  />
        <rect x="5"  y="12" width="3" height="3" rx="0.5" />
        <rect x="9.5" y="12" width="3" height="3" rx="0.5" />
        <rect x="14" y="12" width="3" height="3" rx="0.5" />
      </svg>
    ),
    title: "Semester Planner",
    description:
      "Drag courses into semesters and get instant feedback. Credit overloads, missing prereqs, and scheduling conflicts flagged automatically.",
  },
];

export default function Features() {
  return (
    <section id="features" className="bg-background py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-16 text-center md:text-left">
          <p className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-4">
            Features
          </p>
          <h2 className="font-black text-4xl sm:text-5xl text-text-primary tracking-tight">
            Plan smarter.
          </h2>
        </div>

        {/* Grid — gap-px trick gives a 1-px divider between cells */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-background px-5 py-8 md:px-8 md:py-10 hover:bg-surface transition-colors group"
            >
              <div className="text-red mb-6 transition-transform group-hover:scale-110 origin-left duration-200">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-text-primary text-lg mb-3 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-text-muted text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
