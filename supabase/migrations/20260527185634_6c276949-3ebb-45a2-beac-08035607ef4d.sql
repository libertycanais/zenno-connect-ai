CREATE POLICY "deny all oauth_states to authenticated"
ON public.oauth_states FOR ALL TO authenticated, anon
USING (false) WITH CHECK (false);