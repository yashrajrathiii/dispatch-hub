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
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Shield, Building2, UserPlus, Phone, Mail, Key } from "lucide-react";
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

  // Form states
  const [form, setForm] = useState({
    name: "",
    emailOrPhone: "",
    password: "DispatchHub123",
    role: "STAFF",
    assignedShopId: "NONE",
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*, assigned_shop:shops(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: shops = [] } = useQuery({
    queryKey: ["settings-shops-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shops")
        .select("*")
        .is("deleted_at", null)
        .order("name");
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
          role: form.role,
          assigned_shop_id: form.assignedShopId === "NONE" ? null : form.assignedShopId,
        })
        .eq("auth_user_id", authUserId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: `User "${form.name}" has been created with role "${form.role}".` 
      });
      queryClient.invalidateQueries({ queryKey: ["users-all"] });
      setOpen(false);
      // Reset form
      setForm({
        name: "",
        emailOrPhone: "",
        password: "DispatchHub123",
        role: "STAFF",
        assignedShopId: "NONE",
      });
    },
    onError: (e: any) => {
      toast({ title: "Error creating user", description: e.message, variant: "destructive" });
    },
  });

  const handleOpenAdd = () => {
    setForm({
      name: "",
      emailOrPhone: "",
      password: "DispatchHub123",
      role: "STAFF",
      assignedShopId: "NONE",
    });
    setOpen(true);
  };

  if (appUser?.role !== "OWNER") {
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
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Assigned Shop</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Status</th>
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
                        <span className="text-[10px] text-muted-foreground font-mono">{user.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant="outline" className={roleColors[user.role] || ""}>
                      {user.role}
                    </Badge>
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
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.assigned_shop?.name ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {user.assigned_shop.name}
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge className={user.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
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
            <DialogTitle>Add New User</DialogTitle>
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
                type="text"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="At least 6 characters"
              />
              <span className="text-[10px] text-muted-foreground block">
                The user will use this password to log in for the first time.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="role">Designated Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(val) => setForm((f) => ({ ...f, role: val }))}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OWNER">Owner</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                    <SelectItem value="DRIVER">Driver</SelectItem>
                    <SelectItem value="SALESMAN">Salesman</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="shop">Assigned Shop (Optional)</Label>
                <Select
                  value={form.assignedShopId}
                  onValueChange={(val) => setForm((f) => ({ ...f, assignedShopId: val }))}
                >
                  <SelectTrigger id="shop">
                    <SelectValue placeholder="Select shop" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None / Generic</SelectItem>
                    {shops.map((shop: any) => (
                      <SelectItem key={shop.id} value={shop.id}>
                        {shop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-300" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addUserMutation.mutate()}
              disabled={!form.name || !form.emailOrPhone || form.password.length < 6 || addUserMutation.isPending}
            >
              {addUserMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
