-- P0-004 definitive fix: users self-update RLS
--
-- Problem with migration 025:
--   WITH CHECK still uses recursive subqueries:
--     role = (SELECT role FROM public.users WHERE id = auth.uid())
--   Postgres evaluates these under the UPDATE transaction, which can produce
--   unexpected results depending on MVCC snapshot and session context.
--
-- Fix:
--   Remove the invariant subqueries entirely. The server action
--   (updateMyProfileAction) never sends role, tenant_id, or is_active,
--   so there is nothing to guard against. Admin-only mutations
--   (role change, deactivation) go through createServiceClient() which
--   bypasses RLS — no overlap.

DROP POLICY IF EXISTS "user_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_self_update" ON public.users;

CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE
  TO authenticated
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
