import { signInWithGoogle, signOut } from "@/app/actions";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { ArrowRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeSwitcher } from "./theme-switcher";

export default async function AuthButton() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const initials = user.email?.split('@')[0].slice(0, 2).toUpperCase() || '??';
    
    return (
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.user_metadata.avatar_url} alt={user.email || ''} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="flex-col items-start">
              <div className="text-sm font-medium">{user.email}</div>
              <div className="text-xs text-muted-foreground">gmail connected</div>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/boxes/home">your boxes</Link>
            </DropdownMenuItem>
            <form action={signOut}>
              <DropdownMenuItem asChild>
                <button className="w-full text-left cursor-pointer">
                  logout
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeSwitcher />
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <form action={signInWithGoogle}>
        <Button 
          type="submit"
          size="sm" 
          variant={"outline"} 
          className="group hover:border-[hsl(var(--blood-red))] hover:text-[hsl(var(--blood-red))] transition-colors"
        >
          <span className="flex items-center gap-2">
            your boxes
            <ArrowRight size={16} className="text-muted-foreground group-hover:text-[hsl(var(--blood-red))] transition-colors" />
          </span>
        </Button>
      </form>
      <ThemeSwitcher />
    </div>
  );
}
