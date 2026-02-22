export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-red rounded-[5px] flex items-center justify-center shrink-0">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="2.5" fill="white" />
                <circle cx="6.5" cy="1.5" r="1.5" fill="white" opacity="0.6" />
                <circle cx="11.5" cy="9.5" r="1.5" fill="white" opacity="0.6" />
                <circle cx="1.5" cy="9.5" r="1.5" fill="white" opacity="0.6" />
              </svg>
            </div>
            <span className="font-semibold text-text-primary text-sm tracking-tight">
              Plan Your Degree
            </span>
          </a>

          {/* Links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-text-muted hover:text-text-primary text-sm transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-text-muted hover:text-text-primary text-sm transition-colors">
              How It Works
            </a>
          </div>

          {/* CTA */}
          <a
            href="#waitlist"
            className="bg-red text-white text-sm font-medium rounded-md px-3.5 py-1.5 hover:opacity-90 transition-opacity"
          >
            Join Waitlist
          </a>

        </div>
      </div>
    </nav>
  );
}
