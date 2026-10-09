import { Home } from "@/components/home/home";
import { githubStars } from "@/lib/github";

export default async function HomePage() {
  return <Home stars={await githubStars()} />;
}
