REVOKE EXECUTE ON FUNCTION app_private.current_org_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION app_private.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role, uuid) TO authenticated;