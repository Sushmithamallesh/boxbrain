import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function EnvVarWarning() {
  return (
    <div className="flex gap-4 items-center">
      <Badge variant={"outline"} className="font-normal">
        Supabase environment variables required
      </Badge>
      <Button
        asChild
        size="sm"
        variant={"outline"}
        disabled
        className="opacity-75 cursor-none pointer-events-none"
      >
        <Link href="/dashboard">Connect Gmail</Link>
      </Button>
    </div>
  );
}
