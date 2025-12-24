import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold font-display">Veritas wealth</h1>
        <p className="text-lg text-muted-foreground">
          Manage your finances, investments, and transfers with a modern, secure interface.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Button onClick={() => setLocation('/auth')} className="px-8">Get started</Button>
          <Button variant="secondary" onClick={() => setLocation('/auth')} className="px-8">Sign in</Button>
        </div>

        <p className="text-sm text-muted-foreground mt-4">Already have an account? <a className="text-primary underline" href="/auth">Sign in</a></p>
      </div>
    </div>
  );
}
