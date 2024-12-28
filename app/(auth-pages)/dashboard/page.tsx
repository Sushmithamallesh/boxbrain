import { signInWithGoogle } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { Button } from "@/components/ui/button";

export default async function Dashboard(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold text-[hsl(var(--blood-red))]">boxbrain</h1>
          <div className="space-y-2">
            <p className="text-xl text-muted-foreground">keep tabs on your orders</p>
          </div>
        </div>

        <form action={signInWithGoogle}>
          <Button type="submit" variant="outline" className="w-full h-12 text-base">
            <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
              <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
            </svg>
            sign in with gmail
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          **we'll detect if you're a new or returning user**
        </p>
        <FormMessage message={searchParams} />
      </div>
    </div>
  );
}