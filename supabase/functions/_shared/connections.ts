export async function upsertConnection(
  supabase: any,
  userId: string,
  provider: string,
  status: string,
  externalLabel: string | null,
) {
  // externalLabel is always written, including `null`, so disconnecting
  // actually clears a previously-stored label instead of leaving it stale
  // (e.g. WhatsApp's phone number staying on screen after disconnect).
  const data: Record<string, unknown> = { user_id: userId, provider, status, external_label: externalLabel };
  if (status === "connected") data.connected_at = new Date().toISOString();

  const { error } = await supabase
    .from("connections")
    .upsert(data, { onConflict: "user_id,provider" });
  if (error) throw error;
}
