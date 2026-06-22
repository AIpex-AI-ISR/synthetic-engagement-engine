import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket, Plus, Loader2, UserCircle, Calendar, Target, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMPTY_FORM = {
  persona_id: "",
  goal: "",
  active_days: [],
  target_meeting_date: "",
};

export default function ActiveCampaigns() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadCampaigns();
    loadPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadCampaigns = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, personas(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      toast({ title: "Couldn't load campaigns", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from("personas")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPersonas(data || []);
    } catch (error) {
      toast({ title: "Couldn't load personas", description: error.message, variant: "destructive" });
    }
  };

  const openCreateDialog = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleDialogChange = (open) => {
    setDialogOpen(open);
    if (!open) setForm(EMPTY_FORM);
  };

  const toggleDay = (day) => {
    setForm((f) => ({
      ...f,
      active_days: f.active_days.includes(day)
        ? f.active_days.filter((d) => d !== day)
        : [...f.active_days, day],
    }));
  };

  const handleSave = async () => {
    if (!form.persona_id) {
      toast({ title: "Choose a persona", variant: "destructive" });
      return;
    }
    if (!form.goal.trim()) {
      toast({ title: "Goal is required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        persona_id: form.persona_id,
        goal: form.goal.trim(),
        active_days: form.active_days,
        target_meeting_date: form.target_meeting_date || null,
      };
      const { data, error } = await supabase
        .from("campaigns")
        .insert(payload)
        .select("*, personas(name)")
        .single();
      if (error) throw error;
      setCampaigns((prev) => [data, ...prev]);
      toast({ title: "Campaign created" });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    } catch (error) {
      toast({ title: "Couldn't create campaign", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast({ title: "Campaign deleted" });
      setDeleteTarget(null);
    } catch (error) {
      toast({ title: "Couldn't delete campaign", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasNoPersonas = personas.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold font-heading text-foreground tracking-tight">
            Active Campaigns
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage your running engagement campaigns.
          </p>
        </div>
        <Button
          className="rounded-xl shadow-lg shadow-primary/20 gap-2"
          onClick={openCreateDialog}
          disabled={hasNoPersonas}
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Button>
      </div>

      {hasNoPersonas && !isLoading && (
        <div className="mb-6 rounded-xl border border-border/60 bg-secondary/40 p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            You need a persona before you can launch a campaign.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg gap-1.5 shrink-0"
            onClick={() => navigate("/personas")}
          >
            <UserCircle className="w-3.5 h-3.5" />
            Create a persona
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="glass rounded-2xl p-12 shadow-lg shadow-black/[0.03] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="glass rounded-2xl p-12 shadow-lg shadow-black/[0.03] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Rocket className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold font-heading text-foreground mb-1">
            No campaigns running
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Create a persona first, then launch a campaign to begin automated engagement.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="glass rounded-2xl p-5 shadow-lg shadow-black/[0.03] hover:shadow-xl hover:shadow-black/[0.06] transition-shadow duration-300 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-violet-400 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-white" />
                </div>
                <Badge variant="secondary" className="gap-1">
                  <UserCircle className="w-3 h-3" />
                  {campaign.personas?.name || "Unknown persona"}
                </Badge>
              </div>

              <h3 className="text-base font-semibold font-heading text-foreground mb-2 line-clamp-2">
                {campaign.goal}
              </h3>

              {campaign.active_days?.length > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  {campaign.active_days.join(", ")}
                </p>
              )}

              {campaign.target_meeting_date && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 shrink-0" />
                  Target meeting: {campaign.target_meeting_date}
                </p>
              )}

              <div className="flex items-center justify-end mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(campaign)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
            <DialogDescription>
              Launch a new engagement campaign for one of your personas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Persona <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.persona_id}
                onValueChange={(value) => setForm((f) => ({ ...f, persona_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a persona" />
                </SelectTrigger>
                <SelectContent>
                  {personas.map((persona) => (
                    <SelectItem key={persona.id} value={persona.id}>
                      {persona.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Goal <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.goal}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                placeholder="Book a discovery call"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Active days
              </label>
              <div className="flex flex-wrap gap-3">
                {WEEKDAYS.map((day) => (
                  <label key={day} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                    <Checkbox
                      checked={form.active_days.includes(day)}
                      onCheckedChange={() => toggleDay(day)}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Target meeting date
              </label>
              <input
                type="date"
                value={form.target_meeting_date}
                onChange={(e) => setForm((f) => ({ ...f, target_meeting_date: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => handleDialogChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="rounded-xl">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.goal}&rdquo; and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
