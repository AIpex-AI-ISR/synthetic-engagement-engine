import React, { useEffect, useState } from "react";
import { UserCircle, Plus, Loader2, Pencil, Trash2, Briefcase, Building } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const EMPTY_FORM = {
  name: "",
  job_title: "",
  company: "",
  background_summary: "",
  background_detailed: "",
  status: "Draft",
};

export default function PersonaBuilder() {
  const { user } = useAuth();

  const [personas, setPersonas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadPersonas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPersonas(data || []);
    } catch (error) {
      toast({ title: "Couldn't load personas", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingPersona(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (persona) => {
    setEditingPersona(persona);
    setForm({
      name: persona.name || "",
      job_title: persona.job_title || "",
      company: persona.company || "",
      background_summary: persona.background_summary || "",
      background_detailed: persona.background_detailed || "",
      status: persona.status || "Draft",
    });
    setDialogOpen(true);
  };

  const handleDialogChange = (open) => {
    setDialogOpen(open);
    if (!open) {
      setEditingPersona(null);
      setForm(EMPTY_FORM);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        job_title: form.job_title.trim() || null,
        company: form.company.trim() || null,
        background_summary: form.background_summary.trim() || null,
        background_detailed: form.background_detailed.trim() || null,
        status: form.status,
      };

      if (editingPersona) {
        const { data, error } = await supabase
          .from("personas")
          .update(payload)
          .eq("id", editingPersona.id)
          .select()
          .single();
        if (error) throw error;
        setPersonas((prev) => prev.map((p) => (p.id === data.id ? data : p)));
        toast({ title: "Persona updated" });
      } else {
        const { data, error } = await supabase
          .from("personas")
          .insert({ ...payload, user_id: user.id })
          .select()
          .single();
        if (error) throw error;
        setPersonas((prev) => [data, ...prev]);
        toast({ title: "Persona created" });
      }

      setDialogOpen(false);
      setEditingPersona(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      toast({ title: "Couldn't save persona", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("personas")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      setPersonas((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast({ title: "Persona deleted" });
      setDeleteTarget(null);
    } catch (error) {
      toast({ title: "Couldn't delete persona", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold font-heading text-foreground tracking-tight">
            Persona Builder
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage synthetic engagement profiles.
          </p>
        </div>
        <Button className="rounded-xl shadow-lg shadow-primary/20 gap-2" onClick={openCreateDialog}>
          <Plus className="w-4 h-4" />
          New Persona
        </Button>
      </div>

      {isLoading ? (
        <div className="glass rounded-2xl p-12 shadow-lg shadow-black/[0.03] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : personas.length === 0 ? (
        <div className="glass rounded-2xl p-12 shadow-lg shadow-black/[0.03] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <UserCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold font-heading text-foreground mb-1">
            No personas yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Build your first persona profile to start creating targeted engagement campaigns.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="glass rounded-2xl p-5 shadow-lg shadow-black/[0.03] hover:shadow-xl hover:shadow-black/[0.06] transition-shadow duration-300 cursor-pointer group"
              onClick={() => openEditDialog(persona)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={persona.status === "Active" ? "default" : "outline"}>
                    {persona.status}
                  </Badge>
                </div>
              </div>

              <h3 className="text-base font-semibold font-heading text-foreground mb-1 truncate">
                {persona.name}
              </h3>

              {(persona.job_title || persona.company) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1 truncate">
                  <Briefcase className="w-3.5 h-3.5 shrink-0" />
                  {[persona.job_title, persona.company].filter(Boolean).join(" at ")}
                </p>
              )}

              {persona.background_summary && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {persona.background_summary}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditDialog(persona);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1.5 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(persona);
                  }}
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
            <DialogTitle>{editingPersona ? "Edit Persona" : "New Persona"}</DialogTitle>
            <DialogDescription>
              {editingPersona
                ? "Update this persona's profile details."
                : "Define a new synthetic engagement profile."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Jordan Lee"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> Job title
                </label>
                <Input
                  value={form.job_title}
                  onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
                  placeholder="VP of Sales"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1">
                  <Building className="w-3 h-3" /> Company
                </label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Acme Inc."
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Background summary
              </label>
              <Textarea
                value={form.background_summary}
                onChange={(e) => setForm((f) => ({ ...f, background_summary: e.target.value }))}
                placeholder="A one or two sentence overview of this persona."
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Detailed background
              </label>
              <Textarea
                value={form.background_detailed}
                onChange={(e) => setForm((f) => ({ ...f, background_detailed: e.target.value }))}
                placeholder="Full background, motivations, and context for this persona."
                rows={4}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Status
              </label>
              <div className="flex gap-2">
                {["Draft", "Active"].map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={form.status === option ? "default" : "outline"}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setForm((f) => ({ ...f, status: option }))}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => handleDialogChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="rounded-xl">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingPersona ? "Save changes" : "Create persona"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete persona?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.name}&rdquo; and cannot be undone.
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
