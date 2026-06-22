import { corsHeaders } from "../_shared/cors.ts";
import { userClientFromRequest } from "../_shared/supabaseClient.ts";

// Set with: npx supabase secrets set GEMINI_API_KEY=...
// Get a key at https://aistudio.google.com/apikey
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// Override if the default model id is retired; check the model picker at
// https://aistudio.google.com/ for the current recommended Flash model.
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    company_name: { type: "string", description: "The name of the company" },
    company_summary: {
      type: "string",
      description: "A two-sentence overview of what the company does",
    },
    user_summary: {
      type: "string",
      description:
        "A two-sentence summary about the person/founder who owns this profile: their role, background, and what they personally do",
    },
  },
  required: ["company_name", "company_summary", "user_summary"],
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      return Response.json({ error: "Gemini is not configured" }, { status: 503, headers: corsHeaders });
    }

    const supabase = userClientFromRequest(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { files } = await req.json();
    if (!Array.isArray(files) || files.length === 0) {
      return Response.json({ error: "files is required" }, { status: 400, headers: corsHeaders });
    }

    const downloaded = await Promise.all(
      files.map(async ({ storage_path, file_name }) => {
        if (!storage_path) throw new Error("Every file requires a storage_path");
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from("company-files")
          .download(storage_path);
        if (downloadError) throw downloadError;
        const base64Data = arrayBufferToBase64(await fileBlob.arrayBuffer());
        const mimeType = fileBlob.type || "application/octet-stream";
        return { storage_path, file_name, base64Data, mimeType };
      }),
    );

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text:
                  "Extract the company name, a two-sentence summary of what the company does, and a " +
                  "separate two-sentence summary about the person/founder, based on these documents.",
              },
              ...downloaded.map(({ mimeType, base64Data }) => ({
                inline_data: { mime_type: mimeType, data: base64Data },
              })),
            ],
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      return Response.json({ error: `Gemini request failed: ${detail}` }, { status: 502, headers: corsHeaders });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return Response.json({ error: "Gemini returned no extractable content" }, { status: 502, headers: corsHeaders });
    }
    const extracted = JSON.parse(text);

    const sourceFiles = downloaded.map(({ storage_path, file_name }) => ({
      path: storage_path,
      name: file_name || null,
    }));

    const { data: saved, error: saveError } = await supabase
      .from("company_profiles")
      .upsert(
        {
          user_id: user.id,
          company_name: extracted.company_name || "",
          company_summary: extracted.company_summary || "",
          user_summary: extracted.user_summary || "",
          source_files: sourceFiles,
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();
    if (saveError) throw saveError;

    return Response.json(saved, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
