import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  Upload,
  FileText,
  Loader2,
  Mail,
  Calendar,
  MessageCircle,
  CheckCircle2,
  Unlink,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
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
import { CONNECTOR_IDS, PROVIDERS } from "@/lib/connectors";

const PROVIDER_ICONS = {
  gmail: Mail,
  google_calendar: Calendar,
  whatsapp: MessageCircle,
};

export default function Profile() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  const [companyProfile, setCompanyProfile] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [companySummary, setCompanySummary] = useState("");
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
    const records = await base44.entities.CompanyProfile.filter({ user_id: user.id });
    const record = records[0] || null;
    setCompanyProfile(record);
    setCompanyName(record?.company_name || "");
    setCompanySummary(record?.company_summary || "");
  };

  const loadConnections = async () => {
    setLoadingConnections(true);
    try {
      const result = await base44.functions.invoke("connector-status");
      setConnections(result.data?.connections || {});
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
    const file = event.target.files?.[0];
    if (!file) return;
    setIsExtracting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            company_name: { type: "string", description: "The name of the company" },
            company_summary: {
              type: "string",
              description: "A two-sentence overview of what the company does",
            },
          },
        },
      });

      const data = {
        user_id: user.id,
        company_name: extracted.company_name || "",
        company_summary: extracted.company_summary || "",
        source_file_url: file_url,
        source_file_name: file.name,
      };

      const saved = companyProfile
        ? await base44.entities.CompanyProfile.update(companyProfile.id, data)
        : await base44.entities.CompanyProfile.create(data);

      setCompanyProfile(saved);
      setCompanyName(saved.company_name || "");
      setCompanySummary(saved.company_summary || "");
      toast({ title: "Company profile updated", description: `Extracted from ${file.name}.` });
    } catch (error) {
      toast({ title: "Couldn't read that file", description: error.message, variant: "destructive" });
    } finally {
      setIsExtracting(false);
      event.target.value = "";
    }
  };

  const handleSaveCompany = async () => {
    setIsSavingCompany(true);
    try {
      const fields = { company_name: companyName, company_summary: companySummary };
      const saved = companyProfile
        ? await base44.entities.CompanyProfile.update(companyProfile.id, fields)
        : await base44.entities.CompanyProfile.create({ user_id: user.id, ...fields });
      setCompanyProfile(saved);
      toast({ title: "Saved" });
    } catch (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleConnect = async (provider) => {
    const connectorId = CONNECTOR_IDS[provider];
    if (!connectorId) {
      toast({
        title: "Not configured yet",
        description: `${PROVIDERS[provider].label} needs to be registered in Workspace Settings first.`,
        variant: "destructive",
      });
      return;
    }
    setConnectingProvider(provider);
    try {
      const redirectUrl = await base44.connectors.connectAppUser(connectorId);
      window.location.href = redirectUrl;
    } catch (error) {
      toast({ title: "Couldn't start connection", description: error.message, variant: "destructive" });
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (provider) => {
    const connectorId = CONNECTOR_IDS[provider];
    setConnectingProvider(provider);
    try {
      await base44.connectors.disconnectAppUser(connectorId);
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
      const result = await base44.functions.invoke("whatsapp-connect");
      applyWhatsappResult(result.data);
      if (result.data.status !== "connected") {
        pollRef.current = setInterval(async () => {
          try {
            const statusResult = await base44.functions.invoke("whatsapp-status");
            applyWhatsappResult(statusResult.data);
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
      await base44.functions.invoke("whatsapp-disconnect");
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
              <h2 className="text-base font-semibold font-heading text-foreground">Company</h2>
              <p className="text-sm text-muted-foreground">
                Upload a file about your company to auto-fill these fields.
              </p>
            </div>
          </div>

          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          <Button
            variant="outline"
            className="rounded-xl gap-2 shrink-0"
            disabled={isExtracting}
            onClick={() => fileInputRef.current?.click()}
          >
            {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isExtracting ? "Reading file..." : "Upload company file"}
          </Button>
        </div>

        {companyProfile?.source_file_name && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-4">
            <FileText className="w-3.5 h-3.5" />
            Extracted from {companyProfile.source_file_name}
          </p>
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
