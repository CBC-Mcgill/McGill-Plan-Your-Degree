const steps = [
  {
    number: "01",
    title: "Mark what you've taken",
    description:
      "Check off completed courses and the prerequisite graph updates instantly — every path forward becomes visible.",
  },
  {
    number: "02",
    title: "Explore your skill tree",
    description:
      "Courses unlock as prereqs are met. Navigate the full CS or Engineering graph to chart exactly where you're headed.",
  },
  {
    number: "03",
    title: "Ask Claude anything",
    description:
      "Get semester recommendations, workload advice, and career path guidance — all in plain English, powered by Claude.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-14 text-center md:text-left">
          <p className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-4">
            How it works
          </p>
          <h2 className="font-black text-4xl sm:text-5xl text-text-primary tracking-tight">
            Three steps to clarity.
          </h2>
        </div>

        {/* Steps */}
        <div className="divide-y divide-border">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-5 sm:gap-12 items-start py-8 sm:py-10">
              <div className="font-black text-4xl sm:text-5xl text-red tabular-nums leading-none shrink-0 w-10 sm:w-14">
                {step.number}
              </div>
              <div className="pt-1">
                <h3 className="font-semibold text-text-primary text-xl mb-2.5">
                  {step.title}
                </h3>
                <p className="text-text-muted leading-relaxed text-[15px]">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
