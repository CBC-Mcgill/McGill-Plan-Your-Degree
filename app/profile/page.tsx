import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-14">
      <h1 className="text-4xl">Profile</h1>
      <p className="mt-3 max-w-prose text-lg text-muted-foreground">
        Soon you can import your unofficial transcript here, and it never leaves
        your browser.
      </p>
    </div>
  );
}
