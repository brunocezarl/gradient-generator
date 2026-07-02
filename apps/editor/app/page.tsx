import { redirect } from "next/navigation";

/** Landing page — send users to the project dashboard. */
export default function HomePage() {
  redirect("/dashboard");
}
