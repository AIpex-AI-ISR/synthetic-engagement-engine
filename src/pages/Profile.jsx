import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  Upload,
  FileText,
  Loader2,
  Mail,
  Calendar,
  Inbox,
  MessageCircle,
  CheckCircle2,
  Unlink,
  X,
} from "lucide-react";
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
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { GOOGLE_OAUTH_CONFIGURED, MICROSOFT_OAUTH_CONFIGURED, PROVIDERS, buildAuthorizeUrl } from "@/lib/connectors";

const PROVIDER_ICONS = {
  gmail: Mail,
  google_calendar: Calendar,
  outlook: Inbox,
  whatsapp: MessageCircle,
};

const MAX_COMPANY_FILES = 5;

export default function Profile() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  const [companyProfile, setCompanyProfile] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [companySummary, setCompanySummary] = useState("");
  const [userSummary, setUserSummary] = useState("");
  const [sourceFiles, setSourceFiles] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  const [connections, setConnections] = useState({});
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState(null);

  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappQr, setWhatsappQr] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState("pending");

  useEffect(() => {
    if (!user) return;
    loadCompanyProfile();
    loadConnections();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadCompanyProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      setCompanyProfile(data);
      setCompanyName(data?.company_name || "");
      setCompanySummary(data?.company_summary || "");
      setUserSummary(data?.user_summary || "");
      setSourceFiles(data?.source_files || []);
    } catch (error) {
      toast({ title: "Couldn't load company profile", description: error.message, variant: "destructive" });
    }
  };

  const loadConnections = async () => {
    setLoadingConnections(true);
    try {
      const { data, error } = await supabase
        .from("connections")
        .select("provider, status, external_label")
        .eq("user_id", user.id);
      if (error) throw error;
      const byProvider = {};
      for (const row of data || []) {
        byProvider[row.provider] = { status: row.status, external_label: row.external_label };
      }
      setConnections(byProvider);
    } catch (error) {
      toast({ title: "Couldn't load connectors", description: error.message, variant: "destructive" });
    } finally {
      setLoadingConnections(false);
    }
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleFileChange = async (event) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) return;

    const remainingSlots = MAX_COMPANY_FILES - sourceFiles.length;
    const filesToUpload = selected.slice(0, Math.max(remainingSlots, 0));
    const rejectedCount = selected.length - filesToUpload.length;

    if (rejectedCount > 0) {
      toast({
        title: "Too many files",
        description: `You can have at most ${MAX_COMPANY_FILES} company files. ${rejectedCount} file${rejectedCount === 1 ? "" : "s"} ${rejectedCount === 1 ? "was" : "were"} not uploaded.`,
        variant: "destructive",
      });
    }

    if (filesToUpload.length === 0) {
      event.target.value = "";
      return;
    }

    setIsExtracting(true);
    try {
      const uploaded = await Promise.all(
        filesToUpload.map(async (file) => {
          const storagePath = `${user.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("company-files")
            .upload(storagePath, file, { upsert: true });
          if (uploadError) throw uploadError;
          return { storage_path: storagePath, file_name: file.name };
        }),
      );

      const allFiles = [
        ...sourceFiles.map((f) => ({ storage_path: f.path, file_name: f.name })),
        ...uploaded,
      ];

      const { data: saved, error: extractError } = await supabase.functions.invoke(
        "extract-company-profile",
        { body: { files: allFiles } },
      );
      if (extractError) throw extractError;

      setCompanyProfile(saved);
      setCompanyName(saved.company_name || "");
      setCompanySummary(saved.company_summary || "");
      setUserSummary(saved.user_summary || "");
      setSourceFiles(saved.source_files || []);
      toast({
        title: "Company profile updated",
        description: `Extracted from ${uploaded.map((f) => f.file_name).join(", ")}.`,
      });
    } catch (error) {
      toast({ title: "Couldn't read that file", description: error.message, variant: "destructive" });
    } finally {
      setIsExtracting(false);
      event.target.value = "";
    }
  };

  const handleRemoveSourceFile = async (path) => {
    const remaining = sourceFiles.filter((f) => f.path !== path);
    setIsSavingCompany(true);
    try {
      const { data: saved, error } = await supabase
        .from("company_profiles")
        .upsert(
          { user_id: user.id, source_files: remaining },
          { onConflict: "user_id" },
        )
        .select()
        .single();
      if (error) throw error;
      setCompanyProfile(saved);
      setSourceFiles(saved.source_files || []);
      toast({ title: "File removed" });
    } catch (error) {
      toast({ title: "Couldn't remove file", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleSaveCompany = async () => {
    setIsSavingCompany(true);
    try {
      const { data: saved, error } = await supabase
        .from("company_profiles")
        .upsert(
          {
            user_id: user.id,
            company_name: companyName,
            company_summary: companySummary,
            user_summary: userSummary,
          },
          { onConflict: "user_id" },
        )
        .select()
        .single();
      if (error) throw error;
      setCompanyProfile(saved);
      toast({ title: "Saved" });
    } catch (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleConnect = (provider) => {
    const isConfigured =
      provider === "outlook" ? MICROSOFT_OAUTH_CONFIGURED : GOOGLE_OAUTH_CONFIGURED;
    if (!isConfigured) {
      const oauthProviderName = provider === "outlook" ? "Microsoft" : "Google";
      toast({
        title: "Not configured yet",
        description: `${PROVIDERS[provider].label} needs a ${oauthProviderName} OAuth client configured first.`,
        variant: "destructive",
      });
      return;
    }
    window.location.href = buildAuthorizeUrl(provider);
  };

  const handleDisconnect = async (provider) => {
    setConnectingProvider(provider);
    try {
      const { error } = await supabase.functions.invoke("disconnect-oauth", { body: { provider } });
      if (error) throw error;
      await loadConnections();
      toast({ title: `${PROVIDERS[provider].label} disconnected` });
    } catch (error) {
      toast({ title: "Couldn't disconnect", description: error.message, variant: "destructive" });
    } finally {
      setConnectingProvider(null);
    }
  };

  const applyWhatsappResult = (data) => {
    setWhatsappStatus(data.status);
    setWhatsappQr(data.qr || null);
    setConnections((prev) => ({
      ...prev,
      whatsapp: { status: data.status, external_label: data.external_label || null },
    }));
    if (data.status === "connected") {
      stopPolling();
    }
  };

  const handleWhatsappConnect = async () => {
    stopPolling();
    setWhatsappOpen(true);
    setWhatsappQr(null);
    setWhatsappStatus("pending");
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect");
      if (error) throw error;
      applyWhatsappResult(data);
      if (data.status !== "connected") {
        pollRef.current = setInterval(async () => {
          try {
            const { data: statusData, error: statusError } = await supabase.functions.invoke("whatsapp-status");
            if (statusError) throw statusError;
            applyWhatsappResult(statusData);
          } catch {
            // Transient network hiccup; the next poll tick will retry.
          }
        }, 2500);
      }
    } catch (error) {
      toast({ title: "Couldn't start WhatsApp pairing", description: error.message, variant: "destructive" });
      setWhatsappOpen(false);
    }
  };

  const handleWhatsappDialogChange = (open) => {
    setWhatsappOpen(open);
    if (!open) stopPolling();
  };

  const handleWhatsappDisconnect = async () => {
    setConnectingProvider("whatsapp");
    try {
      const { error } = await supabase.functions.invoke("whatsapp-disconnect");
      if (error) throw error;
      setConnections((prev) => ({ ...prev, whatsapp: { status: "disconnected", external_label: null } }));
      toast({ title: "WhatsApp disconnected" });
    } catch (error) {
      toast({ title: "Couldn't disconnect", description: error.message, variant: "destructive" });
    } finally {
      setConnectingProvider(null);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold font-heading text-foreground tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your company details and connected services.
        </p>
      </div>

      <div className="glass rounded-2xl p-6 shadow-lg shadow-black/[0.03] mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold font-heading text-foreground">
                {companyProfile?.company_name || "Company"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Upload up to {MAX_COMPANY_FILES} files about your company to auto-fill these fields.
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            className="rounded-xl gap-2 shrink-0"
            disabled={isExtracting || sourceFiles.length >= MAX_COMPANY_FILES}
            onClick={() => fileInputRef.current?.click()}
          >
            {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isExtracting ? "Reading files..." : "Upload company file"}
          </Button>
        </div>

        {sourceFiles.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Extracted from {sourceFiles.map((f) => f.name).filter(Boolean).join(", ")}
            </p>
            <ul className="space-y-1.5">
              {sourceFiles.map((f) => (
                <li
                  key={f.path}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5"
                >
                  <span className="text-sm text-foreground truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSourceFile(f.path)}
                    disabled={isSavingCompany}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Company name</label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Summary</label>
            <Textarea
              value={companySummary}
              onChange={(e) => setCompanySummary(e.target.value)}
              placeholder="A two-sentence overview of what the company does."
              rows={3}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">About you</label>
            <Textarea
              value={userSummary}
              onChange={(e) => setUserSummary(e.target.value)}
              placeholder="A two-sentence summary about you: your role, background, and what you personally do."
              rows={3}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveCompany} disabled={isSavingCompany} className="rounded-xl">
              {isSavingCompany ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 shadow-lg shadow-black/[0.03]">
        <h2 className="text-base font-semibold font-heading text-foreground mb-1">Connectors</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Connect the services you want the engine to act on your behalf with.
        </p>

        <div className="space-y-3">
          {Object.values(PROVIDERS).map((provider) => {
            const Icon = PROVIDER_ICONS[provider.key];
            const connection = connections[provider.key];
            const status = connection?.status || "disconnected";
            const isBusy = connectingProvider === provider.key;

            return (
              <div
                key={provider.key}
                className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                    <Icon className="w-[18px] h-[18px] text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{provider.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {status === "connected" && connection?.external_label
                        ? connection.external_label
                        : provider.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {status === "connected" && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </Badge>
                  )}
                  {status === "pending" && <Badge variant="outline">Pending</Badge>}

                  {status === "connected" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg gap-1.5"
                      disabled={isBusy}
                      onClick={() =>
                        provider.key === "whatsapp" ? handleWhatsappDisconnect() : handleDisconnect(provider.key)
                      }
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-lg"
                      disabled={isBusy || loadingConnections}
                      onClick={() =>
                        provider.key === "whatsapp" ? handleWhatsappConnect() : handleConnect(provider.key)
                      }
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Connect"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={whatsappOpen} onOpenChange={handleWhatsappDialogChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Connect WhatsApp</DialogTitle>
            <DialogDescription>
              Open WhatsApp on your phone, go to Settings → Linked Devices → Link a Device, and scan this code.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-4">
            {whatsappStatus === "connected" ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                <p className="text-sm font-medium text-foreground">Connected</p>
              </div>
            ) : whatsappStatus === "disconnected" ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-sm text-muted-foreground">Pairing didn't complete.</p>
                <Button size="sm" onClick={handleWhatsappConnect}>
                  Try again
                </Button>
              </div>
            ) : whatsappQr ? (
              <img
                src={whatsappQr}
                alt="WhatsApp QR code"
                className="w-56 h-56 rounded-xl border border-border/60"
              />
            ) : (
              <div className="w-56 h-56 rounded-xl border border-border/60 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
