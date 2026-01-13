import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Church } from "lucide-react";

export default function Login() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md border-border/50 shadow-2xl backdrop-blur-sm bg-white/80 dark:bg-black/50">
        <CardHeader className="text-center space-y-2 pb-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
            <Church className="w-8 h-8" />
          </div>
          <CardTitle className="text-3xl font-display font-bold">Welcome Back</CardTitle>
          <CardDescription className="text-base">
            Sign in to access the CE Attendance Portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            size="lg" 
            className="w-full text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all" 
            onClick={handleLogin}
          >
            Log in with Replit
          </Button>
          
          <div className="mt-8 text-center text-xs text-muted-foreground">
            <p>Authorized personnel only.</p>
            <p>Contact your administrator for access issues.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
