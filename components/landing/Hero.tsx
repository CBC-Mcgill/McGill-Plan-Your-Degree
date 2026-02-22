import SkillTreeMock from "./SkillTreeMock";

export default function Hero() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 pt-16 pb-24 max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        {/* Left: copy */}
        <div className="text-center lg:text-left">
          {/* Badge */}
          <div className="flex justify-center lg:justify-start mb-8">
            <div className="inline-flex items-center gap-2 bg-red-light border border-red/20 text-red text-xs font-medium rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
              Now in early access · McGill CS &amp; Engineering
            </div>
          </div>

          {/* Headline */}
          <h1 className="font-black text-[44px] sm:text-[56px] lg:text-[72px] text-text-primary tracking-[-0.04em] leading-[1] mb-6">
            Map your<br />
            degree.<br />
            <span className="text-red">Own</span> your<br />
            future.
          </h1>

          {/* Subtext */}
          <p className="text-text-muted text-lg leading-relaxed max-w-sm mb-10 mx-auto lg:mx-0">
            Visualize every prerequisite as an interactive skill tree. Plan
            semesters, track progress, and get AI-powered advice from Claude.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
            <a
              href="#features"
              className="inline-flex items-center gap-2 bg-red text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              Explore the Skill Tree
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M3 7.5h9M8.5 3.5l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <a
              href="#waitlist"
              className="inline-flex items-center gap-2 text-text-muted border border-border font-medium text-sm px-5 py-2.5 rounded-lg hover:border-border hover:text-text-primary transition-colors"
            >
              Join Waitlist
            </a>
          </div>

          {/* Footnote */}
          <p className="text-text-muted text-xs mt-8 font-mono">
            Built for McGill CS · Math · Engineering
          </p>
        </div>

        {/* Right: product mock */}
        <div className="mt-10 lg:mt-0 flex justify-center lg:block">
          <SkillTreeMock />
        </div>

      </div>
    </section>
  );
}
