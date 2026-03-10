
-- Create storage bucket for walk-in proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('walkin-proofs', 'walkin-proofs', true);

-- Allow authenticated users to upload to walkin-proofs
CREATE POLICY "Auth upload walkin proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'walkin-proofs');

-- Allow public read access
CREATE POLICY "Public read walkin proofs" ON storage.objects FOR SELECT USING (bucket_id = 'walkin-proofs');

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
