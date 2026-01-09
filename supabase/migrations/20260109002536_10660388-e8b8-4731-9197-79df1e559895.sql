-- Add unique constraint on voluum_campaign_id for upsert functionality
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_voluum_campaign_id_key UNIQUE (voluum_campaign_id);