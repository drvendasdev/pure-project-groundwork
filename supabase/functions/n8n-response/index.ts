import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const defaultCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Vary": "Origin",
};

function cors(req: Request, extra: Record<string, string> = {}) {
  const reqHeaders = req.headers.get("access-control-request-headers") ?? "authorization, x-client-info, apikey, content-type";
  return {
    ...defaultCorsHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders,
    ...extra,
  };
}

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors(req), "Content-Type": "application/json" },
    });
  }

  // ---- Parse robusto do body ----
  let payload: any = {};
  const ctype = req.headers.get("content-type")?.toLowerCase() ?? "";

  try {
    if (ctype.includes("application/json")) {
      payload = await req.json();
    } else if (ctype.includes("application/x-www-form-urlencoded") || ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      payload = Object.fromEntries(form.entries());
      // se vier JSON stringado em algum campo (ex.: metadata), tenta parse:
      for (const k of Object.keys(payload)) {
        const v = payload[k];
        if (typeof v === "string" && v.trim().startsWith("{") && v.trim().endsWith("}")) {
          try { payload[k] = JSON.parse(v); } catch { /* ignore */ }
        }
      }
    } else {
      const text = await req.text();
      if (text?.trim()) {
        try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: "Invalid request body", details: String(e) }), {
      status: 400,
      headers: { ...cors(req), "Content-Type": "application/json" },
    });
  }

  // ---- Aliases de campos aceitos ----
  const conversation_id =
    payload.conversation_id ?? payload.conversationId ?? payload.conversationID ?? payload.conversation ?? null;

  const response_message =
    payload.response_message ?? payload.message ?? payload.text ?? payload.content ?? null;

  const phone_number =
    payload.phone_number ?? payload.phone ?? payload.to ?? null;

  const message_type =
    (payload.message_type ?? payload.type ?? "text").toString().toLowerCase();

  const file_url  = payload.file_url  ?? payload.url      ?? null;
  const file_name = payload.file_name ?? payload.filename ?? null;
  const metadata  = payload.metadata  ?? payload.meta     ?? null;

  // Request vazio (ping)
  if (!conversation_id && !response_message && !phone_number) {
    return new Response(JSON.stringify({
      success: true,
      message: "Webhook ativo. Envie { conversation_id, response_message } para registrar."
    }), { headers: { ...cors(req), "Content-Type": "application/json" }});
  }

  // Valida obrigatórios
  if (!conversation_id || !response_message) {
    return new Response(JSON.stringify({
      success: false,
      error: "conversation_id e response_message são obrigatórios"
    }), { status: 400, headers: { ...cors(req), "Content-Type": "application/json" }});
  }

  // ---- Env vars ----
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({
      success: false,
      error: "Configuração do servidor ausente: SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY não definidos"
    }), { status: 500, headers: { ...cors(req), "Content-Type": "application/json" }});
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "lovable-n8n-responder" } },
  });

  try {
    // Confirma existência da conversa
    const { data: conversation, error: convErr } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversation_id)
      .single();

    if (convErr) {
      return new Response(JSON.stringify({
        success: false,
        error: "Erro ao buscar conversa",
        details: convErr.message,
        hint: convErr.hint ?? convErr.details ?? null
      }), { status: 500, headers: { ...cors(req), "Content-Type": "application/json" }});
    }

    if (!conversation) {
      return new Response(JSON.stringify({
        success: false,
        error: "Conversa não encontrada"
      }), { status: 404, headers: { ...cors(req), "Content-Type": "application/json" }});
    }

    // Insere a mensagem
    const insertPayload = {
      conversation_id,
      content: response_message,
      sender_type: "ia",          // verifique se seu enum permite 'ia'
      message_type,               // verifique valores aceitos (ex.: 'text', 'image'…)
      file_url,
      file_name,
      status: "sent",
      origem_resposta: "automatica", // remova se a coluna não existir
      metadata: metadata ? { n8n_data: metadata, source: "n8n" } : { source: "n8n" },
      phone_number,               // opcional: só se existir coluna
    };

    const { data: newMessage, error: msgErr } = await supabase
      .from("messages")
      .insert(insertPayload)
      .select()
      .single();

    if (msgErr) {
      return new Response(JSON.stringify({
        success: false,
        error: "Erro ao inserir resposta",
        details: msgErr.message,
        hint: msgErr.hint ?? msgErr.details ?? null,
        payload: insertPayload
      }), { status: 500, headers: { ...cors(req), "Content-Type": "application/json" }});
    }

    // Atualiza conversa (mute erros não-críticos)
    await supabase
      .from("conversations")
      .update({
        last_activity_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      })
      .eq("id", conversation_id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        message_id: newMessage.id,
        conversation_id,
        registered_at: newMessage.created_at,
      }
    }), { headers: { ...cors(req), "Content-Type": "application/json" }});

  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: "Falha inesperada",
      details: String(err?.message ?? err)
    }), { status: 500, headers: { ...cors(req), "Content-Type": "application/json" }});
  }
});
