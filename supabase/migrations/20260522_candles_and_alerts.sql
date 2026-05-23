-- ── 1-MINUTE CANDLES ─────────────────────────────────────────────────────────
-- Primary store for all intraday price data.
-- Composite PK (ticker, ts) enforces one candle per ticker per minute and
-- makes upsert idempotent — re-ingesting the same candle is a no-op.

CREATE TABLE IF NOT EXISTS public.candles_1m (
  ticker  text        NOT NULL,
  ts      timestamptz NOT NULL,
  open    float8      NOT NULL,
  high    float8      NOT NULL,
  low     float8      NOT NULL,
  close   float8      NOT NULL,
  volume  bigint      NOT NULL DEFAULT 0,
  vwap    float8,
  PRIMARY KEY (ticker, ts)
);

-- Fast range scans per ticker (the dominant query pattern)
CREATE INDEX IF NOT EXISTS candles_1m_ticker_ts ON public.candles_1m (ticker, ts DESC);
-- Used by the cleanup job (delete WHERE ts < cutoff)
CREATE INDEX IF NOT EXISTS candles_1m_ts       ON public.candles_1m (ts);

-- Service-role only — no direct user access needed
ALTER TABLE public.candles_1m ENABLE ROW LEVEL SECURITY;


-- ── ALERT RULES ───────────────────────────────────────────────────────────────
-- One row per user-defined condition. The alert engine evaluates all enabled
-- rules every minute during market hours.
--
-- rule_type values:
--   price_above      — price crosses above threshold
--   price_below      — price crosses below threshold
--   vwap_cross_above — price crosses from below to above session VWAP
--   vwap_cross_below — price crosses from above to below session VWAP
--   volume_spike     — current candle volume ≥ threshold × 20-bar avg volume
--   pct_move_up      — % gain from session open ≥ threshold
--   pct_move_down    — % loss from session open ≥ threshold (absolute value)

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker              text        NOT NULL,
  rule_type           text        NOT NULL,
  threshold           float8      NOT NULL,
  enabled             boolean     NOT NULL DEFAULT true,
  cooldown_minutes    integer     NOT NULL DEFAULT 60,
  last_triggered_at   timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_rules_user_id       ON public.alert_rules (user_id);
CREATE INDEX IF NOT EXISTS alert_rules_enabled_ticker ON public.alert_rules (ticker) WHERE enabled;

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own alert rules"
  ON public.alert_rules
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── ALERT FIRINGS ─────────────────────────────────────────────────────────────
-- Append-only log of every time a rule fires. Used for in-app notification
-- history and for confirming delivery to the dashboard via Realtime.

CREATE TABLE IF NOT EXISTS public.alert_firings (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id          uuid        NOT NULL REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL,
  ticker           text        NOT NULL,
  rule_type        text        NOT NULL,
  triggered_value  float8      NOT NULL,
  threshold        float8      NOT NULL,
  message          text,
  fired_at         timestamptz NOT NULL DEFAULT now(),
  delivered        boolean     NOT NULL DEFAULT false
);

-- Recent firings per user (notification history panel)
CREATE INDEX IF NOT EXISTS alert_firings_user_fired  ON public.alert_firings (user_id, fired_at DESC);
-- Undelivered firings (retry / catch-up on reconnect)
CREATE INDEX IF NOT EXISTS alert_firings_undelivered ON public.alert_firings (delivered) WHERE NOT delivered;

ALTER TABLE public.alert_firings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own firings"
  ON public.alert_firings
  FOR SELECT
  USING (auth.uid() = user_id);
