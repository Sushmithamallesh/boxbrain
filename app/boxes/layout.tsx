import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function BoxesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/");
  }

  return (
    <div className="flex-1 w-full flex flex-col">
      {children}
    </div>
  );
} 