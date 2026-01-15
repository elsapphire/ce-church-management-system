import { Sidebar } from "./Sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
          {children}
        </div>
      </main>
    </div>
  );
}
