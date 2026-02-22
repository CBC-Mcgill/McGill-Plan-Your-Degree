"use server";

export async function joinWaitlist(
  email: string
): Promise<{ success: boolean }> {
  // TODO: insert into Supabase waitlist table
  console.log("Waitlist signup:", email);
  return { success: true };
}
