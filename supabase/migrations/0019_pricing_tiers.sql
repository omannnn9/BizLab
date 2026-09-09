-- =====================================================================
-- BizLab — 0019: Commercial pricing tiers — Starter / Growth /
-- Business / Enterprise, replacing the placeholder Free/Starter/
-- Business/Enterprise catalog seeded in 0011.
--
-- Repurposes the 4 existing rows in place, matched by their ORIGINAL
-- key, so company_subscriptions.plan_id foreign keys never dangle for
-- companies that already exist: old 'free' becomes the new 'starter',
-- old 'starter' becomes the new 'growth', 'business' and 'enterprise'
-- keep their keys and get updated specs/features.
--
-- Order matters here and is NOT interchangeable: the 'starter' ->
-- 'growth' rename must run *before* 'free' -> 'starter', or the second
-- statement's `WHERE key = 'starter'` would also match the row the
-- first statement just renamed *to* 'starter', retargeting it to
-- 'growth' as well and colliding with the unique constraint on `key`.
-- =====================================================================

update public.subscription_plans set
  key = 'growth', name = 'Growth', description = 'For teams ready to run the whole business here',
  price_monthly_cents = 3900, price_annual_cents = 37400,
  max_members = 50, storage_quota_bytes = 53687091200, position = 1,
  features = '{"tasks":true,"documents":true,"files":true,"chat":true,"whiteboards":true,"knowledge_hub":true,"crm":true,"hr":false,"finance":false,"audit_logs":false,"sso":false,"guest_seats":10}'
where key = 'starter';

update public.subscription_plans set
  key = 'starter', name = 'Starter', description = 'For small teams getting organized',
  price_monthly_cents = 1500, price_annual_cents = 14400,
  max_members = 10, storage_quota_bytes = 10737418240, position = 0,
  features = '{"tasks":true,"documents":true,"files":true,"chat":true,"whiteboards":false,"knowledge_hub":false,"crm":false,"hr":false,"finance":false,"audit_logs":false,"sso":false,"guest_seats":0}'
where key = 'free';

update public.subscription_plans set
  description = 'For growing companies that need HR, finance and control',
  price_monthly_cents = 8900, price_annual_cents = 85400,
  max_members = 250, storage_quota_bytes = 268435456000, position = 2,
  features = '{"tasks":true,"documents":true,"files":true,"chat":true,"whiteboards":true,"knowledge_hub":true,"crm":true,"hr":true,"finance":true,"audit_logs":true,"sso":false,"guest_seats":50}'
where key = 'business';

update public.subscription_plans set
  description = 'Advanced security, unlimited scale — custom pricing available',
  price_monthly_cents = 24900, price_annual_cents = 239000,
  max_members = null, storage_quota_bytes = 2199023255552, position = 3,
  features = '{"tasks":true,"documents":true,"files":true,"chat":true,"whiteboards":true,"knowledge_hub":true,"crm":true,"hr":true,"finance":true,"audit_logs":true,"sso":true,"guest_seats":null}'
where key = 'enterprise';

-- New companies land on the real entry tier during their 14-day trial
-- (seed_company_subscription, 0011) — that function looked up the
-- plan by key = 'free', which no longer exists after the rename above.
create or replace function public.seed_company_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_subscriptions (company_id, plan_id, status)
  select new.id, id, 'trialing' from public.subscription_plans where key = 'starter';
  return new;
end;
$$;
