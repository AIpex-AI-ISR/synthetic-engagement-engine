import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getOAuthRedirectUri, OAUTH_STATE_STORAGE_KEY, PROVIDERS } from "@/lib/connectors";

// Shared landing page for every provider's Authorization Code redirect
// (Google and Microsoft both send the user back here with `code` + `state`
// in the query string). Verifies the CSRF `state` we stashed in
// sessionStorage before redirecting, hands the code off to the
// oauth-callback Edge Function to do the actual token exchange, then sends
// the user back to the Profile page.
export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ranRef = useRef(false);

  const [status, setStatus] = useState("loading"); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState("Completing connection...");

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const run = async () => {
      const code = searchParams.get("code");
      const stateParam = searchParams.get("state");
      const errorParam = searchParams.get("error_description") || searchParams.get("error");

      if (errorParam) {
        setStatus("error");
        setMessage(errorParam);
        return;
      }

      if (!code || !stateParam || !stateParam.includes(":")) {
        setStatus("error");
        setMessage("Missing authorization code or state.");
        return;
      }

      const [provider, state] = stateParam.split(":");
      const stored = sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY);
      sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);

      let parsedStored;
      try {
        parsedStored = stored ? JSON.parse(stored) : null;
      } catch {
        parsedStored = null;
      }

      if (!parsedStored || parsedStored.state !== state || parsedStored.provider !== provider) {
        setStatus("error");
        setMessage("Could not verify this request. Please try connecting again.");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("oauth-callback", {
          body: { provider, code, redirect_uri: getOAuthRedirectUri() },
        });
        if (error) throw error;

        const label = PROVIDERS[provider]?.label || provider;
        setStatus("success");
        setMessage(
          data?.external_label
            ? `${label} connected as ${data.external_label}.`
            : `${label} connected.`,
        );
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "Something went wrong while connecting.");
        return;
      }

      setTimeout(() => navigate("/profile", { replace: true }), 1500);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass rounded-2xl p-8 shadow-lg shadow-black/[0.03] max-w-sm w-full text-center">
        {status === "loading" && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground">{message}</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground">{message}</p>
            <p className="text-xs text-muted-foreground mt-2">Redirecting to your profile...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-8 h-8 text-destructive mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground">Couldn't connect</p>
            <p className="text-xs text-muted-foreground mt-2">{message}</p>
            <button
              type="button"
              className="text-xs text-primary hover:underline mt-4"
              onClick={() => navigate("/profile", { replace: true })}
            >
              Back to profile
            </button>
          </>
        )}
      </div>
    </div>
  );
}
