import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // What's next and the Planner merged into Plan, and Requirements into What's next before that.
  redirects: async () => [
    { source: "/next", destination: "/plan", permanent: true },
    { source: "/requirements", destination: "/plan", permanent: true },
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
