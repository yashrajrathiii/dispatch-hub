import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus,
  Search,
  Check,
  Trash2,
  Edit,
  Upload,
  X,
  Building2,
  AlertCircle,
  Loader2,
  FileCheck2,
  CalendarDays,
  User,
  Hash,
  IndianRupee,
  RefreshCw,
  Camera,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const COMMON_BANKS = [
  "SBI",
  "HDFC",
  "ICICI",
  "Axis",
  "Kotak",
  "BOB",
  "IDBI",
  "Canara",
  "PNB",
  "UBI",
  "Yes Bank",
  "IndusInd",
  "UCO",
  "Karnataka Bank",
  "Federal Bank",
  "Au Small Finance",
];

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  if (dateStr.includes("/")) return dateStr;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const parseInputDate = (input: string): string => {
  const clean = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const year = parts[0];
      const month = parts[1].padStart(2, "0");
      const day = parts[2].padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    let year = parts[2];
    if (year.length === 2) {
      year = "20" + year;
    }
    return `${year}-${month}-${day}`;
  }
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch (e) {}
  return input;
};

interface CheckRecord {
  id: string;
  date: string;
  party_name: string;
  buyer_id: string | null;
  check_number: string;
  bank_name: string;
  amount: number;
  cleared: boolean;
  created_at: string;
}

export default function CheckClearance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter and search states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "cleared">("all");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Modals & Form states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"manual" | "bulk">("manual");
  const [editingCheck, setEditingCheck] = useState<CheckRecord | null>(null);

  // Manual form fields
  const [dateVal, setDateVal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [partyName, setPartyName] = useState("");
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [partySearchFocused, setPartySearchFocused] = useState(false);
  const [checkNumber, setCheckNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankSearchFocused, setBankSearchFocused] = useState(false);
  const [amount, setAmount] = useState("");

  // Edit form suggestion focus state
  const [editPartySearchFocused, setEditPartySearchFocused] = useState(false);
  const [editBankSearchFocused, setEditBankSearchFocused] = useState(false);

  // Bulk CSV/Paste fields
  const [bulkText, setBulkText] = useState("");
  const [parsedRows, setParsedRows] = useState<Array<Omit<CheckRecord, "id" | "created_at" | "cleared">>>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Fetch checks
  const { data: checks = [], isLoading } = useQuery<CheckRecord[]>({
    queryKey: ["check-clearances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("check_clearances")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CheckRecord[];
    },
  });

  // Fetch buyers for autocomplete
  const { data: buyers = [] } = useQuery({
    queryKey: ["buyers-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buyers")
        .select("id, name, phone")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const [isScanning, setIsScanning] = useState(false);

  const handleScanCheque = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const res = reader.result as string;
          const base64Data = res.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = (err) => reject(err);
      });

      const { data, error } = await supabase.functions.invoke("parse-cheque", {
        body: {
          image: base64,
          mimeType: file.type || "image/jpeg"
        }
      });

      if (error) throw error;

      if (data && !data.error) {
        if (data.date) setDateVal(data.date);
        if (data.check_number) setCheckNumber(data.check_number);
        if (data.party_name) {
          setPartyName(data.party_name);
          const matchedBuyer = buyers.find(
            (b) => b.name.toLowerCase() === data.party_name.toLowerCase()
          );
          if (matchedBuyer) {
            setSelectedBuyerId(matchedBuyer.id);
          }
        }
        if (data.bank_name) setBankName(data.bank_name);
        if (data.amount) setAmount(String(data.amount));

        toast({
          title: "Cheque Scanned Successfully",
          description: "All details have been pre-filled. Please review before saving."
        });
      } else {
        throw new Error(data?.error || "Could not extract cheque details.");
      }
    } catch (err: any) {
      toast({
        title: "Scanning Failed",
        description: err.message || "Failed to scan the cheque. Please try manually.",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
      e.target.value = "";
    }
  };

  // Autocomplete suggestions for Add form (Buyers + Previous entry party names)
  const partySuggestions = useMemo(() => {
    if (!partyName || selectedBuyerId) return [];
    const q = partyName.toLowerCase();
    
    // Get matching buyers
    const matchingBuyers = buyers
      .filter((b) => b.name.toLowerCase().includes(q))
      .map((b) => ({ id: b.id, name: b.name, source: "Buyer" }));

    // Get matching previous custom party names entered in the ledger
    const uniquePreviousParties = Array.from(new Set(checks.map((c) => c.party_name)));
    const matchingPrevious = uniquePreviousParties
      .filter((p) => p.toLowerCase().includes(q) && !buyers.some((b) => b.name.toLowerCase() === p.toLowerCase()))
      .map((p) => ({ id: null, name: p, source: "Previously Used" }));

    return [...matchingBuyers, ...matchingPrevious].slice(0, 8);
  }, [buyers, checks, partyName, selectedBuyerId]);

  // Autocomplete suggestions for Add form (Standard banks + Previous entry bank names)
  const bankSuggestions = useMemo(() => {
    const q = bankName.toLowerCase();
    const uniquePreviousBanks = Array.from(new Set(checks.map((c) => c.bank_name)));
    
    // Combine standard banks list and previously saved bank entries
    const allBanks = Array.from(new Set([...uniquePreviousBanks, ...COMMON_BANKS]));
    
    if (!bankName) {
      return allBanks.slice(0, 8);
    }
    return allBanks.filter((b) => b.toLowerCase().includes(q)).slice(0, 8);
  }, [checks, bankName]);

  // Autocomplete suggestions for Edit form (Buyers + Previous entry party names)
  const editPartySuggestions = useMemo(() => {
    if (!editingCheck || !editingCheck.party_name) return [];
    const q = editingCheck.party_name.toLowerCase();
    
    const matchingBuyers = buyers
      .filter((b) => b.name.toLowerCase().includes(q))
      .map((b) => ({ id: b.id, name: b.name, source: "Buyer" }));

    const uniquePreviousParties = Array.from(new Set(checks.map((c) => c.party_name)));
    const matchingPrevious = uniquePreviousParties
      .filter((p) => p.toLowerCase().includes(q) && !buyers.some((b) => b.name.toLowerCase() === p.toLowerCase()))
      .map((p) => ({ id: null, name: p, source: "Previously Used" }));

    return [...matchingBuyers, ...matchingPrevious].slice(0, 8);
  }, [buyers, checks, editingCheck]);

  // Autocomplete suggestions for Edit form (Standard banks + Previous entry bank names)
  const editBankSuggestions = useMemo(() => {
    if (!editingCheck) return [];
    const q = editingCheck.bank_name.toLowerCase();
    const uniquePreviousBanks = Array.from(new Set(checks.map((c) => c.bank_name)));
    const allBanks = Array.from(new Set([...uniquePreviousBanks, ...COMMON_BANKS]));
    
    if (!editingCheck.bank_name) {
      return allBanks.slice(0, 8);
    }
    return allBanks.filter((b) => b.toLowerCase().includes(q)).slice(0, 8);
  }, [checks, editingCheck]);

  // Mutations
  const createCheck = useMutation({
    mutationFn: async (newCheck: Omit<CheckRecord, "id" | "created_at" | "cleared">) => {
      const { error } = await supabase.from("check_clearances").insert([
        {
          date: newCheck.date,
          party_name: newCheck.party_name,
          buyer_id: newCheck.buyer_id,
          check_number: newCheck.check_number,
          bank_name: newCheck.bank_name,
          amount: newCheck.amount,
          cleared: false,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["check-clearances"] });
      setIsAddOpen(false);
      resetManualForm();
      toast({ title: "Success", description: "Cheque record added successfully." });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to add cheque record.",
        variant: "destructive",
      });
    },
  });

  const createBulkChecks = useMutation({
    mutationFn: async (rows: Array<Omit<CheckRecord, "id" | "created_at" | "cleared">>) => {
      const records = rows.map((r) => ({
        date: r.date,
        party_name: r.party_name,
        buyer_id: r.buyer_id,
        check_number: r.check_number,
        bank_name: r.bank_name,
        amount: r.amount,
        cleared: false,
      }));
      const { error } = await supabase.from("check_clearances").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["check-clearances"] });
      setIsAddOpen(false);
      setBulkText("");
      setParsedRows([]);
      toast({ title: "Success", description: `Successfully imported ${parsedRows.length} cheques.` });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to import cheques.",
        variant: "destructive",
      });
    },
  });

  const updateCheckMutation = useMutation({
    mutationFn: async (updated: CheckRecord) => {
      const { error } = await supabase
        .from("check_clearances")
        .update({
          date: updated.date,
          party_name: updated.party_name,
          buyer_id: updated.buyer_id,
          check_number: updated.check_number,
          bank_name: updated.bank_name,
          amount: updated.amount,
          cleared: updated.cleared,
          updated_at: new Date().toISOString(),
        })
        .eq("id", updated.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["check-clearances"] });
      setEditingCheck(null);
      toast({ title: "Success", description: "Cheque record updated successfully." });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to update cheque.",
        variant: "destructive",
      });
    },
  });

  const toggleCleared = useMutation({
    mutationFn: async ({ id, cleared }: { id: string; cleared: boolean }) => {
      const { error } = await supabase
        .from("check_clearances")
        .update({ cleared, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["check-clearances"] });
      toast({
        title: variables.cleared ? "Cheque Cleared" : "Clearance Reverted",
        description: variables.cleared
          ? "Cheque status updated to Cleared."
          : "Cheque status updated to Pending.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to update cheque clearance.",
        variant: "destructive",
      });
    },
  });

  const deleteCheck = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("check_clearances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["check-clearances"] });
      toast({ title: "Deleted", description: "Cheque record deleted successfully." });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to delete cheque record.",
        variant: "destructive",
      });
    },
  });

  // Reset forms
  const resetManualForm = () => {
    setDateVal(format(new Date(), "yyyy-MM-dd"));
    setPartyName("");
    setSelectedBuyerId(null);
    setCheckNumber("");
    setBankName("");
    setAmount("");
  };

  // Autocomplete handlers
  const handleSelectBuyer = (buyer: { id: string; name: string }) => {
    setSelectedBuyerId(buyer.id);
    setPartyName(buyer.name);
    setPartySearchFocused(false);
  };

  const handleSelectBank = (bank: string) => {
    setBankName(bank);
    setBankSearchFocused(false);
  };

  // CSV/Text bulk parser
  const handleParseBulk = () => {
    setParseError(null);
    if (!bulkText.trim()) {
      setParseError("Please enter some text or upload a CSV first.");
      return;
    }

    try {
      const lines = bulkText.split(/\r?\n/);
      const rows: Array<Omit<CheckRecord, "id" | "created_at" | "cleared">> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip blank lines

        // Split by comma or tab
        const delimiter = line.includes("\t") ? "\t" : ",";
        const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ""));

        if (parts.length < 4) {
          throw new Error(
            `Line ${i + 1} is invalid. Required format: Date, Party Name, Cheque Number, Bank, Amount`
          );
        }

        // Parse fields
        const dateStr = parts[0];
        const party = parts[1];
        const checkNum = parts[2];
        const bank = parts[3];
        const amountNum = Number(parts[4]);

        if (isNaN(amountNum) || amountNum <= 0) {
          throw new Error(`Line ${i + 1}: Amount '${parts[4]}' must be a positive number.`);
        }

        // Try mapping party to buyer ID
        const matchedBuyer = buyers.find(
          (b) => b.name.toLowerCase() === party.toLowerCase()
        );

        rows.push({
          date: parseInputDate(dateStr),
          party_name: party,
          buyer_id: matchedBuyer ? matchedBuyer.id : null,
          check_number: checkNum,
          bank_name: bank,
          amount: amountNum,
        });
      }

      setParsedRows(rows);
    } catch (err: any) {
      setParseError(err.message || "Failed to parse CSV. Please check the format.");
    }
  };

  // File upload trigger
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setBulkText(text);
      toast({ title: "File loaded", description: "CSV file content loaded. Click Parse to review." });
    };
    reader.readAsText(file);
  };

  // Submit manual check
  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateVal || !partyName || !checkNumber || !bankName || !amount) {
      toast({ title: "Incomplete Form", description: "All fields are required.", variant: "destructive" });
      return;
    }

    createCheck.mutate({
      date: dateVal,
      party_name: partyName,
      buyer_id: selectedBuyerId,
      check_number: checkNumber,
      bank_name: bankName,
      amount: Number(amount),
    });
  };

  // Save edited check
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCheck) return;
    updateCheckMutation.mutate(editingCheck);
  };

  // Filter checks list
  const filteredChecks = useMemo(() => {
    return checks.filter((c) => {
      const matchesSearch =
        c.party_name.toLowerCase().includes(search.toLowerCase()) ||
        c.check_number.includes(search) ||
        c.bank_name.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && !c.cleared) ||
        (statusFilter === "cleared" && c.cleared);

      // Date range filtering
      if (startDate && c.date < startDate) return false;
      if (endDate && c.date > endDate) return false;

      return matchesSearch && matchesStatus;
    });
  }, [checks, search, statusFilter, startDate, endDate]);

  // Statistics calculation
  const stats = useMemo(() => {
    const dateFiltered = checks.filter((c) => {
      if (startDate && c.date < startDate) return false;
      if (endDate && c.date > endDate) return false;
      return true;
    });

    const totalCount = dateFiltered.length;
    const clearedCount = dateFiltered.filter((c) => c.cleared).length;
    const pendingCount = totalCount - clearedCount;

    const clearedAmount = dateFiltered
      .filter((c) => c.cleared)
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const pendingAmount = dateFiltered
      .filter((c) => !c.cleared)
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const totalAmount = clearedAmount + pendingAmount;

    const clearRate = totalCount > 0 ? Math.round((clearedCount / totalCount) * 100) : 0;

    return {
      totalCount,
      clearedCount,
      pendingCount,
      totalAmount,
      clearedAmount,
      pendingAmount,
      clearRate,
    };
  }, [checks, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Header and Statistics Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Manage bank cheques, upload sheets, and track clearance ledger.
          </p>
        </div>
        <Button
          onClick={() => {
            resetManualForm();
            setActiveTab("manual");
            setIsAddOpen(true);
          }}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md self-start"
        >
          <Plus className="h-4 w-4" /> Add or Import Cheques
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-medium text-warning">Pending Clearance</p>
          <p className="mt-2 text-3xl font-bold text-warning">
            ₹{stats.pendingAmount.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs text-warning/80">{stats.pendingCount} cheques pending</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-medium text-success">Cleared Value</p>
          <p className="mt-2 text-3xl font-bold text-success">
            ₹{stats.clearedAmount.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs text-success/80">{stats.clearedCount} cheques cleared</p>
        </div>
      </div>

      {/* Filter and Ledger Table Section */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground self-start">Cheque Register</h2>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search party, cheque #, bank..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background border-input"
              />
            </div>

            {/* Status Select Filter */}
            <Select
              value={statusFilter}
              onValueChange={(v: any) => setStatusFilter(v)}
            >
              <SelectTrigger className="w-36 bg-background border-input">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cheques</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cleared">Cleared</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-36 justify-start text-left font-normal border-input bg-background text-foreground hover:bg-muted/50 h-10 text-xs",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{startDate ? formatDate(startDate) : "Start Date"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate ? new Date(startDate) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(format(date, "yyyy-MM-dd"));
                      }
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <span className="text-muted-foreground text-xs font-medium">to</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-36 justify-start text-left font-normal border-input bg-background text-foreground hover:bg-muted/50 h-10 text-xs",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{endDate ? formatDate(endDate) : "End Date"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate ? new Date(endDate) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setEndDate(format(date, "yyyy-MM-dd"));
                      }
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {(startDate || endDate) && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setStartDate(null);
                    setEndDate(null);
                  }}
                  className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  title="Clear Date Filter"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Cheques Register Table */}
        <div className="overflow-x-auto border border-border rounded-lg bg-card">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading cheques register...</span>
            </div>
          ) : filteredChecks.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No matching bank cheques found.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Party Name</th>
                  <th className="px-5 py-4">Cheque Number</th>
                  <th className="px-5 py-4">Bank Name</th>
                  <th className="px-5 py-4 text-right">Amount</th>
                  <th className="px-5 py-4 text-center">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredChecks.map((check) => (
                  <tr
                    key={check.id}
                    className={cn(
                      "transition-colors hover:bg-muted/10",
                      check.cleared && "bg-muted/5 text-muted-foreground"
                    )}
                  >
                    <td className="px-5 py-4 font-medium">
                      {formatDate(check.date)}
                    </td>
                    <td className="px-5 py-4 font-semibold text-foreground">
                      {check.party_name}
                    </td>
                    <td
                      className={cn(
                        "px-5 py-4 font-mono",
                        check.cleared && "line-through text-muted-foreground/60"
                      )}
                    >
                      {check.check_number}
                    </td>
                    <td className="px-5 py-4">{check.bank_name}</td>
                    <td
                      className={cn(
                        "px-5 py-4 text-right font-semibold text-foreground",
                        check.cleared && "line-through text-muted-foreground/60"
                      )}
                    >
                      ₹{check.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() =>
                          toggleCleared.mutate({ id: check.id, cleared: !check.cleared })
                        }
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2",
                          check.cleared
                            ? "bg-success/15 text-success hover:bg-success/20 border border-success/30 focus:ring-success"
                            : "bg-warning/15 text-warning hover:bg-warning/20 border border-warning/30 focus:ring-warning"
                        )}
                        title={check.cleared ? "Mark as pending" : "Mark as cleared"}
                        disabled={toggleCleared.isPending}
                      >
                        {check.cleared ? (
                          <>
                            {/* Circle-C styled Badge like handwritten ledger */}
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-[11px] font-black text-success-foreground">
                              C
                            </span>
                            <span>Cleared</span>
                          </>
                        ) : (
                          <>
                            <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                            <span>Pending</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingCheck(check)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Delete this cheque record? This action cannot be undone.")) {
                              deleteCheck.mutate(check.id);
                            }
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Import Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" />
              Add Cheque Records
            </DialogTitle>
            <DialogDescription>
              Enter a single cheque detail manually or parse a pasted spreadsheet/CSV list.
            </DialogDescription>
          </DialogHeader>

          {/* Tab selector */}
          <div className="flex border-b border-border mb-4">
            <button
              onClick={() => setActiveTab("manual")}
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors",
                activeTab === "manual"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Manual Entry Form
            </button>
            <button
              onClick={() => setActiveTab("bulk")}
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors",
                activeTab === "bulk"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Bulk Upload / Copy-Paste
            </button>
          </div>

          {/* Tabs Content */}
          {activeTab === "manual" ? (
            <form onSubmit={handleSubmitManual} className="space-y-4">
              {/* AI Scanner Button */}
              <div className="flex items-center justify-between p-3.5 bg-primary/5 rounded-lg border border-primary/20">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    Scan Cheque Photo
                  </p>
                  <p className="text-xs text-muted-foreground">Upload or capture an image to automatically fill the form.</p>
                </div>
                <label className="cursor-pointer inline-flex items-center justify-center rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm font-semibold shadow-sm transition-all h-9 shrink-0">
                  {isScanning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-1.5" />
                      Scan Photo
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={isScanning}
                    onChange={handleScanCheque}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" /> Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal border-input bg-background text-foreground hover:bg-muted/50 h-10",
                          !dateVal && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                        {dateVal ? formatDate(dateVal) : "Select Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100]" align="start">
                      <Calendar
                        mode="single"
                        selected={dateVal ? new Date(dateVal) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setDateVal(format(date, "yyyy-MM-dd"));
                          }
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkNum" className="flex items-center gap-1.5">
                    <Hash className="h-4 w-4 text-muted-foreground" /> Cheque Number
                  </Label>
                  <Input
                    id="checkNum"
                    placeholder="e.g. 005369"
                    required
                    value={checkNumber}
                    onChange={(e) => setCheckNumber(e.target.value)}
                    className="bg-background border-input font-mono"
                  />
                </div>
              </div>

              {/* Party Name input with Autocomplete Suggestions (Buyers + Previous Names) */}
              <div className="space-y-2 relative">
                <Label htmlFor="party" className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-muted-foreground" /> Party Name
                </Label>
                <Input
                  id="party"
                  placeholder="Type party name or search buyer..."
                  required
                  value={partyName}
                  onChange={(e) => {
                    setPartyName(e.target.value);
                    setSelectedBuyerId(null); // clear ID if typing custom name
                  }}
                  onFocus={() => setPartySearchFocused(true)}
                  onBlur={() => setTimeout(() => setPartySearchFocused(false), 200)}
                  className="bg-background border-input"
                />
                {partySearchFocused && partySuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg divide-y divide-border">
                    {partySuggestions.map((party) => (
                      <button
                        key={party.name + "-" + party.source}
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex justify-between items-center"
                        onMouseDown={() => {
                          if (party.source === "Buyer") {
                            handleSelectBuyer({ id: party.id!, name: party.name });
                          } else {
                            setPartyName(party.name);
                            setSelectedBuyerId(null);
                            setPartySearchFocused(false);
                          }
                        }}
                      >
                        <span className="font-medium text-foreground">{party.name}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {party.source}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Bank Name input with Autocomplete Suggestions (Standard + Previous entries) */}
                {/* dropdown is placed inside absolute bottom-full to open upwards, avoiding cutoffs */}
                <div className="space-y-2 relative">
                  <Label htmlFor="bank" className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-muted-foreground" /> Bank Name
                  </Label>
                  <Input
                    id="bank"
                    placeholder="e.g. HDFC, Kotak"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    onFocus={() => setBankSearchFocused(true)}
                    onBlur={() => setTimeout(() => setBankSearchFocused(false), 200)}
                    className="bg-background border-input"
                  />
                  {bankSearchFocused && bankSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 bottom-full mb-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg divide-y divide-border">
                      {bankSuggestions.map((bank) => (
                        <button
                          key={bank}
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm hover:bg-accent font-medium text-foreground"
                          onMouseDown={() => handleSelectBank(bank)}
                        >
                          {bank}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="flex items-center gap-1.5">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" /> Amount
                  </Label>
                  <Input
                    type="number"
                    id="amount"
                    placeholder="₹ Amount"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-background border-input font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  className="border-input text-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createCheck.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {createCheck.isPending ? "Saving..." : "Save Cheque"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label htmlFor="bulkPaste" className="text-sm font-semibold">
                  Paste Cheque Data (CSV or Excel column copy)
                </Label>
                <div className="flex gap-2">
                  {/* File Selector */}
                  <label className="cursor-pointer inline-flex items-center justify-center rounded-md border border-input px-3 py-1.5 text-xs font-semibold bg-background hover:bg-muted text-foreground transition-all">
                    <Upload className="h-3 w-3 mr-1" />
                    Upload CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground bg-muted/50 p-2.5 rounded-md border border-border">
                Format: <code className="font-semibold font-mono">Date, Party Name, Cheque Number, Bank, Amount</code>
                <br />
                Example: <code className="font-semibold font-mono">2026-06-19, Ghanshyam Pro., 005369, Kotak, 14433</code>
              </div>

              <textarea
                id="bulkPaste"
                rows={6}
                placeholder="2026-06-15,Amar Super,082634,Axis,3750&#10;2026-06-16,Jai Baba Tr.,181253,UBI,14578"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full p-3 rounded-lg border border-input bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />

              {parseError && (
                <div className="bg-destructive/15 text-destructive p-3 rounded-lg flex items-start gap-2 text-xs border border-destructive/20 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-success uppercase tracking-wider">
                    Parsed Rows ({parsedRows.length})
                  </Label>
                  <div className="max-h-40 overflow-y-auto border border-border rounded-lg text-xs bg-muted/10 divide-y divide-border">
                    {parsedRows.map((row, rIdx) => (
                      <div key={rIdx} className="p-2.5 flex justify-between gap-3">
                        <span className="font-mono text-muted-foreground">{formatDate(row.date)}</span>
                        <span className="font-semibold text-foreground flex-1 truncate">
                          {row.party_name}
                        </span>
                        <span className="font-mono text-muted-foreground">{row.check_number}</span>
                        <span>{row.bank_name}</span>
                        <span className="font-bold text-foreground">
                          ₹{row.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-border mt-6">
                {parsedRows.length > 0 ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setParsedRows([])}
                      className="border-input text-foreground hover:bg-muted"
                    >
                      Clear Parsed
                    </Button>
                    <Button
                      type="button"
                      onClick={() => createBulkChecks.mutate(parsedRows)}
                      disabled={createBulkChecks.isPending}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {createBulkChecks.isPending
                        ? "Importing..."
                        : `Import ${parsedRows.length} Cheques`}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddOpen(false)}
                      className="border-input text-foreground hover:bg-muted"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleParseBulk}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Parse & Review
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingCheck}
        onOpenChange={(o) => {
          if (!o) setEditingCheck(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Edit Cheque Record
            </DialogTitle>
            <DialogDescription>Update values for this cheque record.</DialogDescription>
          </DialogHeader>

          {editingCheck && (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editDate">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="editDate"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal border-input bg-background text-foreground hover:bg-muted/50 h-10",
                          !editingCheck.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                        {editingCheck.date ? formatDate(editingCheck.date) : "Select Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100]" align="start">
                      <Calendar
                        mode="single"
                        selected={editingCheck.date ? new Date(editingCheck.date) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setEditingCheck({
                              ...editingCheck,
                              date: format(date, "yyyy-MM-dd")
                            });
                          }
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editCheckNum">Cheque Number</Label>
                  <Input
                    id="editCheckNum"
                    required
                    value={editingCheck.check_number}
                    onChange={(e) =>
                      setEditingCheck({ ...editingCheck, check_number: e.target.value })
                    }
                    className="bg-background border-input font-mono"
                  />
                </div>
              </div>

              {/* Party Name field in Edit Dialog with suggestions */}
              <div className="space-y-2 relative">
                <Label htmlFor="editParty">Party Name</Label>
                <Input
                  id="editParty"
                  required
                  value={editingCheck.party_name}
                  onChange={(e) => {
                    setEditingCheck({ ...editingCheck, party_name: e.target.value, buyer_id: null });
                  }}
                  onFocus={() => setEditPartySearchFocused(true)}
                  onBlur={() => setTimeout(() => setEditPartySearchFocused(false), 200)}
                  className="bg-background border-input"
                />
                {editPartySearchFocused && editPartySuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg divide-y divide-border">
                    {editPartySuggestions.map((party) => (
                      <button
                        key={party.name + "-" + party.source}
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex justify-between items-center"
                        onMouseDown={() => {
                          setEditingCheck({
                            ...editingCheck,
                            party_name: party.name,
                            buyer_id: party.source === "Buyer" ? party.id : null
                          });
                          setEditPartySearchFocused(false);
                        }}
                      >
                        <span className="font-medium text-foreground">{party.name}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {party.source}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Bank Name field in Edit Dialog with suggestions (opens upwards) */}
                <div className="space-y-2 relative">
                  <Label htmlFor="editBank">Bank Name</Label>
                  <Input
                    id="editBank"
                    required
                    value={editingCheck.bank_name}
                    onChange={(e) =>
                      setEditingCheck({ ...editingCheck, bank_name: e.target.value })
                    }
                    onFocus={() => setEditBankSearchFocused(true)}
                    onBlur={() => setTimeout(() => setEditBankSearchFocused(false), 200)}
                    className="bg-background border-input"
                  />
                  {editBankSearchFocused && editBankSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 bottom-full mb-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg divide-y divide-border">
                      {editBankSuggestions.map((bank) => (
                        <button
                          key={bank}
                          type="button"
                          className="w-full text-left px-4 py-2 text-sm hover:bg-accent font-medium text-foreground"
                          onMouseDown={() => {
                            setEditingCheck({ ...editingCheck, bank_name: bank });
                            setEditBankSearchFocused(false);
                          }}
                        >
                          {bank}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editAmount">Amount</Label>
                  <Input
                    type="number"
                    id="editAmount"
                    required
                    min="1"
                    value={editingCheck.amount}
                    onChange={(e) =>
                      setEditingCheck({ ...editingCheck, amount: Number(e.target.value) })
                    }
                    className="bg-background border-input font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingCheck(null)}
                  className="border-input text-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateCheckMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {updateCheckMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
