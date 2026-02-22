"use client";

import { useState } from "react";
import { joinWaitlist } from "@/app/actions";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await joinWaitlist(email);
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <section id="waitlist" className="bg-surface border-t border-border py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto text-center">

        <p className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-5">
          Early Access
        </p>

        <h2 className="font-black text-4xl sm:text-5xl text-text-primary tracking-tight mb-4">
          Be first to know.
        </h2>

        <p className="text-text-muted text-lg mb-10 leading-relaxed">
          Launching for McGill students this fall.
          Drop your email and we&apos;ll reach out when it&apos;s ready.
        </p>

        {submitted ? (
          <div className="flex items-center justify-center gap-3 bg-elevated border border-border rounded-xl px-6 py-5 shadow-sm">
            <div className="w-7 h-7 bg-surface rounded-full flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7l3.5 3.5L12 3" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-text-primary font-medium text-sm">
              You&apos;re on the list — we&apos;ll be in touch!
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="email"
              required
              placeholder="your@mail.mcgill.ca"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 min-w-0 bg-background border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-red focus:ring-2 focus:ring-red/10 transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-red text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 whitespace-nowrap shrink-0 w-full sm:w-auto"
            >
              {loading ? "Joining…" : "Notify Me →"}
            </button>
          </form>
        )}

        <p className="text-text-muted text-xs font-mono mt-8">
          ✦ Built by students, for students · McGill CBC 2026
        </p>

      </div>
    </section>
  );
}
