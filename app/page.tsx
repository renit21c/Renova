import RenovaApp from "./renova-app";

export default function Page() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }

  return (
    <RenovaApp
      googleCalendarEnabled={
        process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED === "true"
      }
    />
  );
}
