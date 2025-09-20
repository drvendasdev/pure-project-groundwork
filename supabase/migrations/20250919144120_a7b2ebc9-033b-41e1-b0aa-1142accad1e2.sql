-- Enable RLS on remaining tables that need it
-- Final migration to fix remaining RLS issues

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_instance_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_webhook_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_webhook_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_limits ENABLE ROW LEVEL SECURITY;