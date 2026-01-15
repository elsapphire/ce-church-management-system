import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import logoUrl from "@assets/ce-logo-removebg-preview_1768304044152.png";
import { apiRequest, queryClient } from "@/lib/queryClient";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/login", data);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    } catch (err: any) {
      const message = err?.message || "Login failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md border-border/50 shadow-2xl backdrop-blur-sm bg-white/80 dark:bg-black/50">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 p-2 overflow-hidden">
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <CardTitle className="text-3xl font-display font-bold text-foreground">Welcome Back</CardTitle>
          <CardDescription className="text-base">
            Sign in to access the Abuja Zone 1 portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" data-testid="error-message">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="identifier">Email or Username</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="Enter your email or username"
                {...form.register("identifier")}
                disabled={isLoading}
                data-testid="input-identifier"
              />
              {form.formState.errors.identifier && (
                <p className="text-sm text-destructive">{form.formState.errors.identifier.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                {...form.register("password")}
                disabled={isLoading}
                data-testid="input-password"
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-base font-semibold shadow-lg shadow-primary/20"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>Authorized personnel only.</p>
            <p>Contact your administrator for access issues.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
