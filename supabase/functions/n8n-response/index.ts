// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const defaultCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Vary": "Origin",
};

function cors(req: Request, extra: Record<string, string> = {}) {
  const reqHeaders =
    req.headers.get("access-control-request-headers") ??
    "authorization, x-client-info, apikey, content-type";
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
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...cors(req), "Content-Type": "application/json" } },
    );
  }

  // ---------- Parse robusto do body ----------
  let payload: any = {};
  const ctype = req.headers.get("content-type")?.toLowerCase() ?? "";

  try {
    if (ctype.includes("application/json")) {
      payload = await req.json();
    } else if (
      ctype.includes("application/x-www-form-urlencoded") ||
      ctype.includes("multipart/form-data")
    ) {
      const form = await req.formData();
      payload = Object.fromEntries(form.entries());
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
    return new Response(
      JSON.stringify({ success: false, error: "Invalid request body", details: String(e) }),
      { status: 400, headers: { ...cors(req), "Content-Type": "application/json" } },
    );
  }

  // ---------- Aliases & normalização ----------
  const convIdAlias =
    payload.conversation_id ??
    payload.conversationId ??
    payload.conversationID ??
    payload.conversation ??
    null;

  const response_message =
    payload.response_message ??
    payload.message ??
    payload.text ??
    payload.caption ??
    payload.content ??
    null;

  const phone_number =
    payload.phone_number ?? payload.phoneNumber ?? payload.phone ?? payload.to ?? null;

  const message_type_raw = (payload.message_type ?? payload.messageType ?? payload.type ?? "text");
  const file_url  = payload.file_url  ?? payload.fileUrl  ?? payload.url      ?? null;
  const file_name = payload.file_name ?? payload.fileName ?? payload.filename ?? null;

  const evolution_instance =
    payload.evolution_instance ?? payload.evolutionInstance ?? payload.instance ?? null;

  const metadata = payload.metadata ?? payload.meta ?? null;

  const sender_type = (payload.sender_type ?? "agent").toString().toLowerCase();

  const inferMessageType = (url?: string): string => {
    if (!url) return "text";
    const ext = url.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "jpg": case "jpeg": case "png": case "gif": case "webp": return "image";
      case "mp4": case "mov": case "avi": case "webm": return "video";
      case "mp3": case "wav": case "ogg": case "m4a": case "opus": return "audio";
      case "pdf": case "doc": case "docx": case "txt": return "document";
      default: return "document";
    }
  };

  const finalMessageType = (message_type_raw || "").toString().toLowerCase() ||
    inferMessageType(file_url || "");

  const hasValidContent = !!(response_message || (file_url && finalMessageType !== "text"));

  // Ping: nada relevante enviado
  if (!convIdAlias && !phone_number && !response_message && !file_url) {
    return new Response(JSON.stringify({
      success: true,
      message: "Webhook ativo. Envie { conversation_id ou phone_number, response_message ou file_url } para registrar.",
    }), { headers: { ...cors(req), "Content-Type": "application/json" } });
  }

  // Regras mínimas
  if (!convIdAlias && !phone_number) {
    return new Response(JSON.stringify({
      success: false,
      error: "conversation_id ou phone_number são obrigatórios",
    }), { status: 400, headers: { ...cors(req), "Content-Type": "application/json" } });
  }

  if (!hasValidContent) {
    return new Response(JSON.stringify({
      success: false,
      error: "É necessário response_message ou file_url com tipo válido",
    }), { status: 400, headers: { ...cors(req), "Content-Type": "application/json" } });
  }

  // ---- Env vars / Supabase ----
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({
      success: false,
      error: "Configuração ausente: SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY",
    }), { status: 500, headers: { ...cors(req), "Content-Type": "application/json" } });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "lovable-n8n-responder" } },
  });

  console.log('📥 N8N Response received:', {
    conversation_id: convIdAlias,
    phone_number,
    response_message: response_message?.substring(0, 100),
    message_type: finalMessageType,
    file_url,
    file_name,
    sender_type,
    metadata: metadata ? 'present' : 'none'
  });

  try {
    // ---------- Resolver conversation_id (fallback por phone_number) ----------
    let conversation_id: string | null = convIdAlias;

    if (!conversation_id && phone_number) {
      const sanitized = String(phone_number).replace(/\D/g, "");
      // 1) Busca/Cria contato
      let { data: contact, error: contactErr } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("phone", sanitized)
        .single();

      if (contactErr && contactErr.code !== "PGRST116") {
        throw new Error(`Erro ao buscar contato: ${contactErr.message}`);
      }

      if (!contact) {
        const ins = await supabase
          .from("contacts")
          .insert({
            phone: sanitized,
            name: `Contato ${sanitized}`,
            workspace_id: "00000000-0000-0000-0000-000000000000", // Workspace padrão
            created_at: new Date().toISOString(),
          })
          .select("id, name")
          .single();
        if (ins.error) throw new Error(`Erro ao criar contato: ${ins.error.message}`);
        contact = ins.data;
      }

      // 2) Busca conversa aberta no WhatsApp
      const { data: existingConv, error: convSearchErr } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", contact.id)
        .eq("canal", "whatsapp")
        .eq("status", "open")
        .single();

      if (!existingConv) {
        // Cria conversa
        const insConv = await supabase
          .from("conversations")
          .insert({
            contact_id: contact.id,
            workspace_id: "00000000-0000-0000-0000-000000000000", // Workspace padrão
            canal: "whatsapp",
            status: "open",
            agente_ativo: false,
            evolution_instance: evolution_instance || null,
            last_activity_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (insConv.error) throw new Error(`Erro ao criar conversa: ${insConv.error.message}`);
        conversation_id = insConv.data.id;
      } else {
        conversation_id = existingConv.id;
      }
    }

    // ---------- Confirma conversa e opcionalmente atualiza evolution_instance ----------
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
        hint: (convErr as any).hint ?? (convErr as any).details ?? null,
      }), { status: 500, headers: { ...cors(req), "Content-Type": "application/json" } });
    }

    if (!conversation) {
      return new Response(JSON.stringify({
        success: false,
        error: "Conversa não encontrado",
      }), { status: 404, headers: { ...cors(req), "Content-Type": "application/json" } });
    }

    if (evolution_instance && evolution_instance !== conversation.evolution_instance) {
      await supabase
        .from("conversations")
        .update({ evolution_instance })
        .eq("id", conversation_id);
    }

    // ---------- Monta conteúdo (placeholder para mídia sem texto) ----------
    const generateContentForMedia = (type: string, name?: string): string => {
      switch (type) {
        case "image": return `📷 Imagem${name ? `: ${name}` : ""}`;
        case "video": return `🎥 Vídeo${name ? `: ${name}` : ""}`;
        case "audio": return `🎵 Áudio${name ? `: ${name}` : ""}`;
        case "document": return `📄 Documento${name ? `: ${name}` : ""}`;
        default: return name || "Arquivo";
      }
    };

    const finalContent = response_message || generateContentForMedia(finalMessageType, file_name);

    // ---------- Insere mensagem ----------
    const insertPayload: any = {
      conversation_id,
      workspace_id: conversation.workspace_id,  // Adicionar workspace_id da conversa
      content: finalContent,
      sender_type,                  // ex.: 'agent' | 'ia'
      message_type: finalMessageType, // 'text' | 'image' | 'video' | 'audio' | 'document'
      file_url,
      file_name,
      status: "sent",
      origem_resposta: "automatica",
      metadata: metadata ? { n8n_data: metadata, source: "n8n" } : { source: "n8n" },
    };

    console.log('💾 Inserting message with payload:', {
      conversation_id,
      content_length: finalContent.length,
      sender_type,
      message_type: finalMessageType,
      has_file: !!file_url,
      metadata_present: !!metadata
    });

    const { data: newMessage, error: msgErr } = await supabase
      .from("messages")
      .insert(insertPayload)
      .select()
      .single();

    if (msgErr) {
      console.error('❌ Database insertion failed:', {
        error: msgErr.message,
        code: msgErr.code,
        hint: (msgErr as any).hint,
        details: (msgErr as any).details,
        payload: insertPayload
      });
      return new Response(JSON.stringify({
        success: false,
        error: "Erro ao inserir resposta",
        details: msgErr.message,
        hint: (msgErr as any).hint ?? (msgErr as any).details ?? null,
        payload: insertPayload,
      }), { status: 500, headers: { ...cors(req), "Content-Type": "application/json" } });
    }

    console.log('✅ Message inserted successfully:', {
      message_id: newMessage.id,
      conversation_id,
      content: finalContent.substring(0, 50) + (finalContent.length > 50 ? '...' : ''),
      created_at: newMessage.created_at
    });

    // ---------- Atualiza conversa ----------
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
      },
    }), { headers: { ...cors(req), "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: "Falha inesperada",
      details: String(err?.message ?? err),
    }), { status: 500, headers: { ...cors(req), "Content-Type": "application/json" } });
  }
});
