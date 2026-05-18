-- Phase C: Admin Push Notifications
--
-- Tabela: push_subscriptions
-- Skladišti Web Push subscription credentials za admin uređaje.
-- Po RFC 8030, svaki uređaj/browser ima svoj endpoint (URL koji push
-- provider daje) + dva ključa za enkripciju (p256dh i auth).
--
-- user_id veže subscription za konkretnog admin user-a (auth.users.id)
-- tako da možemo invalidate sve subscriptions na logout / password change.
--
-- endpoint je UNIQUE — isti uređaj ne može imati dvije subscriptions
-- za istu app instancu (browser će vratiti isti endpoint na re-subscribe).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text          NOT NULL UNIQUE,
  p256dh      text          NOT NULL,
  auth        text          NOT NULL,
  user_agent  text          NULL,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  last_used_at timestamptz  NULL
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions(user_id);

-- RLS: svaki user vidi/upravlja samo svojim subscriptions.
-- Service role (used by send-push util) bypass-uje RLS i čita sve.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions: user can read own"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "push_subscriptions: user can insert own"
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "push_subscriptions: user can delete own"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
