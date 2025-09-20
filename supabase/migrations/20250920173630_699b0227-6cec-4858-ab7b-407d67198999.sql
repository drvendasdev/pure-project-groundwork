-- Enable real-time for workspace_configurations table
ALTER TABLE public.workspace_configurations REPLICA IDENTITY FULL;

-- Add workspace_configurations to realtime publication if not already added
DO $$
BEGIN
    -- Check if table is already in publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'workspace_configurations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE workspace_configurations;
    END IF;
END $$;