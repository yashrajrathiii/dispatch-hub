import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Key, Check, X, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsSecurity() {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Strength checks
  const hasMinLength = password.length >= 8;
  const hasUpperLower = /[A-Z]/.test(password) && /[a-z]/.test(password);
  const hasNumberOrSpecial = /[\d\W]/.test(password);
  
  const isStrong = hasMinLength && hasUpperLower && hasNumberOrSpecial;
  const matches = password === confirmPassword && confirmPassword !== "";

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStrong) {
      toast({
        title: "Weak Password",
        description: "Please make sure your password meets all strength requirements.",
        variant: "destructive",
      });
      return;
    }
    if (!matches) {
      toast({
        title: "Passwords Do Not Match",
        description: "Please confirm your new password correctly.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your password has been updated successfully.",
      });

      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({
        title: "Error updating password",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Security Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your credentials and account security</p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" /> Change Password
          </CardTitle>
          <CardDescription>Update your login password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="focus-visible:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(
                  "focus-visible:ring-primary",
                  confirmPassword && !matches && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {confirmPassword && !matches && (
                <span className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5" /> Passwords do not match
                </span>
              )}
            </div>

            {/* Password Strength Guidelines */}
            <div className="p-3.5 rounded-lg bg-muted/30 border border-border text-xs space-y-2 mt-2">
              <p className="font-semibold text-muted-foreground mb-1.5">Password Requirements:</p>
              
              <div className="flex items-center gap-2">
                {hasMinLength ? (
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={cn(hasMinLength ? "text-green-700 font-medium" : "text-muted-foreground")}>
                  At least 8 characters long
                </span>
              </div>

              <div className="flex items-center gap-2">
                {hasUpperLower ? (
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={cn(hasUpperLower ? "text-green-700 font-medium" : "text-muted-foreground")}>
                  Contains both uppercase & lowercase letters
                </span>
              </div>

              <div className="flex items-center gap-2">
                {hasNumberOrSpecial ? (
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={cn(hasNumberOrSpecial ? "text-green-700 font-medium" : "text-muted-foreground")}>
                  Contains a number or special character
                </span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 mt-2"
              disabled={!isStrong || !matches || loading}
            >
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
