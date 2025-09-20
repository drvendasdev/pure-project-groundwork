-- Remove a constraint duplicada que pode estar causando conflito
ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS fk_tags_org;