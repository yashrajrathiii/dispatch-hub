import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Shield, UserPlus, Phone, Mail, Key, Pencil, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Initialize a secondary Supabase client without session persistence
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const secondaryClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const roleColors: Record<string, string> = {
  OWNER: "bg-red-100 text-red-800 border-red-200",
  ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
  STAFF: "bg-blue-100 text-blue-800 border-blue-200",
  ACCOUNTANT: "bg-green-100 text-green-800 border-green-200",
  DRIVER: "bg-amber-100 text-amber-800 border-amber-200",
  SALESMAN: "bg-cyan-100 text-cyan-800 border-cyan-200",
};

export default function SettingsUsers() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  // Form states
  const [form, setForm] = useState<{ name: string; emailOrPhone: string; password: string; roles: string[]; isActive: boolean }>({
    name: "",
    emailOrPhone: "",
    password: "",
    roles: ["STAFF"],
    isActive: true,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\s+/g, "");
    if (/^\d{10}$/.test(cleaned)) {
      return `+91${cleaned}`;
    }
    if (/^\d{12}$/.test(cleaned) && cleaned.startsWith("91")) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith("+")) {
      return cleaned;
    }
    return cleaned;
  };

  const addUserMutation = useMutation({
    mutationFn: async () => {
      if (editUserId) {
        // Edit mode: update name, roles, and status
        const { error } = await supabase
          .from("users")
          .update({
            name: form.name,
            role: `{${form.roles.join(",")}}` as any,
            is_active: form.isActive,
          })
          .eq("id", editUserId);
        if (error) throw error;
      } else {
        // Create mode: sign up auth user and update profile
        const isEmail = form.emailOrPhone.includes("@");
        const credentials = isEmail
          ? { email: form.emailOrPhone, password: form.password }
          : { phone: formatPhone(form.emailOrPhone), password: form.password };

        // 1. Sign up the user via the secondary client to prevent logging out the current owner
        const { data: authData, error: authError } = await secondaryClient.auth.signUp({
          ...credentials,
          options: {
            data: {
              full_name: form.name,
            },
          },
        });

        if (authError) throw authError;

        const authUserId = authData.user?.id;
        if (!authUserId) throw new Error("Could not retrieve new user credentials.");

        // 2. Update the public.users record created by the database trigger
        const { error: updateError } = await supabase
          .from("users")
          .update({
            name: form.name,
            email: isEmail ? form.emailOrPhone : null,
            phone: !isEmail ? formatPhone(form.emailOrPhone) : null,
            role: `{${form.roles.join(",")}}` as any,
            is_active: form.isActive,
          })
          .eq("auth_user_id", authUserId);

        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: editUserId 
          ? `User "${form.name}" has been updated.`
          : `User "${form.name}" has been created with roles "${form.roles.join(", ")}".` 
      });
      queryClient.invalidateQueries({ queryKey: ["users-all"] });
      setOpen(false);
      setEditUserId(null);
      // Reset form
      setForm({
        name: "",
        emailOrPhone: "",
        password: "",
        roles: ["STAFF"],
        isActive: true,
      });
    },
    onError: (e: any) => {
      toast({ title: "Error saving user", description: e.message, variant: "destructive" });
    },
  });

  const handleOpenAdd = () => {
    setEditUserId(null);
    setForm({
      name: "",
      emailOrPhone: "",
      password: "",
      roles: ["STAFF"],
      isActive: true,
    });
    setOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    setEditUserId(user.id);
    setForm({
      name: user.name,
      emailOrPhone: user.email || user.phone || "",
      password: "",
      roles: Array.isArray(user.role) ? user.role : [user.role],
      isActive: user.is_active,
    });
    setOpen(true);
  };

  if (!appUser?.role.includes("OWNER")) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">Only the owner is authorized to manage user accounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">Add and manage user accounts and application roles</p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2 bg-primary hover:bg-primary/90">
          <UserPlus className="h-4 w-4" /> Add New User
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-card shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No users registered yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left bg-muted/30">
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Contact</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: any) => (
                <tr key={user.id} className="border-b border-gray-200 last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div>{user.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(user.role) ? (
                        user.role.map((r: string) => (
                          <Badge key={r} variant="outline" className={roleColors[r] || ""}>
                            {r}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className={roleColors[user.role] || ""}>
                          {user.role}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {user.email}
                      </div>
                    )}
                    {user.phone && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone className="h-3.5 w-3.5" />
                        {user.phone}
                      </div>
                    )}
                    {!user.email && !user.phone && <span>—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge className={user.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEdit(user)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add User Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md border border-gray-200">
          <DialogHeader>
            <DialogTitle>{editUserId ? "Edit User Roles & Details" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. John Doe"
              />
            </div>
            
            {!editUserId && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="emailOrPhone">Email or Mobile Number *</Label>
                  <Input
                    id="emailOrPhone"
                    value={form.emailOrPhone}
                    onChange={(e) => setForm((f) => ({ ...f, emailOrPhone: e.target.value }))}
                    placeholder="e.g. john@example.com or 9876543210"
                  />
                  <span className="text-[10px] text-muted-foreground block">
                    Enter an email address or a 10-digit mobile number for login credentials.
                  </span>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="password">Temporary Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="At least 6 characters"
                  />
                  <span className="text-[10px] text-muted-foreground block">
                    The user will use this password to log in for the first time.
                  </span>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Designated Roles *</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {Object.keys(roleColors).map((roleKey) => {
                  const isChecked = form.roles.includes(roleKey);
                  return (
                    <label 
                      key={roleKey} 
                      className={`flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-colors ${
                        isChecked 
                          ? "bg-accent/40 border-primary" 
                          : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const updatedRoles = e.target.checked
                            ? [...form.roles, roleKey]
                            : form.roles.filter((r) => r !== roleKey);
                          // Ensure at least one role is selected
                          if (updatedRoles.length > 0) {
                            setForm((f) => ({ ...f, roles: updatedRoles }));
                          }
                        }}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      <Badge variant="outline" className={roleColors[roleKey] || ""}>
                        {roleKey}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
              <div>
                <Label htmlFor="status-toggle" className="font-semibold block cursor-pointer">Active / Approved Status</Label>
                <span className="text-[10px] text-muted-foreground block">
                  Inactive users will be blocked from accessing the app dashboard.
                </span>
              </div>
              <input
                id="status-toggle"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-300" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addUserMutation.mutate()}
              disabled={!form.name || (!editUserId && (!form.emailOrPhone || form.password.length < 6)) || addUserMutation.isPending}
            >
              {addUserMutation.isPending ? "Saving..." : editUserId ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
