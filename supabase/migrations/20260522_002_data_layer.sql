-- ── News articles ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_articles (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id  text        UNIQUE NOT NULL,
  headline     text        NOT NULL,
  summary      text,
  url          text        UNIQUE NOT NULL,
  source       text,
  published_at timestamptz NOT NULL,
  tickers      text[]      DEFAULT '{}',
  sentiment    text        DEFAULT 'neutral',
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_articles_published_at_idx ON news_articles (published_at DESC);
CREATE INDEX IF NOT EXISTS news_articles_tickers_idx      ON news_articles USING gin (tickers);
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news read" ON news_articles FOR SELECT TO authenticated USING (true);

-- ── Calendar events (economic + earnings) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id    text UNIQUE NOT NULL,
  event_type     text NOT NULL,   -- 'economic' | 'earnings'
  ticker         text,
  title          text NOT NULL,
  event_date     date NOT NULL,
  event_time     text,
  impact         text,            -- 'HIGH' | 'MEDIUM' | 'LOW'
  actual_value   text,
  expected_value text,
  previous_value text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calendar_events_date_idx   ON calendar_events (event_date);
CREATE INDEX IF NOT EXISTS calendar_events_ticker_idx ON calendar_events (ticker) WHERE ticker IS NOT NULL;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar read" ON calendar_events FOR SELECT TO authenticated USING (true);

-- ── Daily price snapshots (derived from candles_1m at EOD) ────────────────────
CREATE TABLE IF NOT EXISTS price_snapshots (
  ticker  text    NOT NULL,
  date    date    NOT NULL,
  open    numeric,
  high    numeric,
  low     numeric,
  close   numeric,
  volume  bigint,
  vwap    numeric,
  PRIMARY KEY (ticker, date)
);
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_snapshots read" ON price_snapshots FOR SELECT TO authenticated USING (true);

-- ── FRED macro indicators ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS macro_indicators (
  series_id   text    NOT NULL,
  date        date    NOT NULL,
  value       numeric,
  series_name text,
  PRIMARY KEY (series_id, date)
);
ALTER TABLE macro_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "macro read" ON macro_indicators FOR SELECT TO authenticated USING (true);

-- ── Insider transactions (Form 4 via Finnhub) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS insider_transactions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id      text UNIQUE NOT NULL,
  ticker           text NOT NULL,
  insider_name     text,
  insider_title    text,
  transaction_type text,
  shares           numeric,
  price_per_share  numeric,
  total_value      numeric,
  transaction_date date,
  filed_at         date,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS insider_transactions_ticker_idx   ON insider_transactions (ticker);
CREATE INDEX IF NOT EXISTS insider_transactions_filed_at_idx ON insider_transactions (filed_at DESC);
ALTER TABLE insider_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insider read" ON insider_transactions FOR SELECT TO authenticated USING (true);

-- ── Analyst ratings / upgrades / downgrades (FMP) ─────────────────────────────
CREATE TABLE IF NOT EXISTS analyst_ratings (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id           text UNIQUE NOT NULL,
  ticker                text NOT NULL,
  analyst_firm          text,
  rating                text,
  previous_rating       text,
  price_target          numeric,
  previous_price_target numeric,
  action                text,
  rated_at              date NOT NULL,
  created_at            timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analyst_ratings_ticker_idx   ON analyst_ratings (ticker);
CREATE INDEX IF NOT EXISTS analyst_ratings_rated_at_idx ON analyst_ratings (rated_at DESC);
ALTER TABLE analyst_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analyst read" ON analyst_ratings FOR SELECT TO authenticated USING (true);

-- ── Options flow snapshots (FMP) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS options_flow (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id        text UNIQUE NOT NULL,
  ticker             text NOT NULL,
  contract_type      text,
  strike             numeric,
  expiry             date,
  premium            numeric,
  volume             bigint,
  open_interest      bigint,
  implied_volatility numeric,
  sentiment          text,
  snapshot_date      date NOT NULL,
  created_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS options_flow_ticker_idx        ON options_flow (ticker);
CREATE INDEX IF NOT EXISTS options_flow_snapshot_date_idx ON options_flow (snapshot_date DESC);
ALTER TABLE options_flow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "options read" ON options_flow FOR SELECT TO authenticated USING (true);

-- ── Sector performance snapshots (FMP) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sector_snapshots (
  id            uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  sector        text    NOT NULL,
  change_pct    numeric,
  snapshot_date date    NOT NULL,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (sector, snapshot_date)
);
ALTER TABLE sector_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sector read" ON sector_snapshots FOR SELECT TO authenticated USING (true);

-- ── SEC filings (Finnhub) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sec_filings (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id text UNIQUE NOT NULL,
  ticker      text NOT NULL,
  filing_type text,
  title       text,
  filed_at    date,
  url         text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sec_filings_ticker_idx ON sec_filings (ticker);
ALTER TABLE sec_filings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sec read" ON sec_filings FOR SELECT TO authenticated USING (true);

-- ── Congressional trades (scaffold — wire Quiver Quant when ready) ────────────
CREATE TABLE IF NOT EXISTS congressional_trades (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id      text UNIQUE NOT NULL,
  ticker           text,
  politician_name  text NOT NULL,
  chamber          text,   -- 'house' | 'senate'
  party            text,
  state            text,
  transaction_type text,   -- 'purchase' | 'sale'
  amount_range     text,
  transaction_date date,
  disclosure_date  date,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS congressional_trades_ticker_idx ON congressional_trades (ticker) WHERE ticker IS NOT NULL;
ALTER TABLE congressional_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "congress read" ON congressional_trades FOR SELECT TO authenticated USING (true);

-- ── Short interest (scaffold — wire FINRA / Quiver when ready) ────────────────
CREATE TABLE IF NOT EXISTS short_interest (
  ticker             text    NOT NULL,
  report_date        date    NOT NULL,
  short_volume       bigint,
  short_volume_ratio numeric,
  days_to_cover      numeric,
  PRIMARY KEY (ticker, report_date)
);
ALTER TABLE short_interest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "short read" ON short_interest FOR SELECT TO authenticated USING (true);

-- ── Institutional holdings 13F (scaffold — wire SEC EDGAR / Quiver when ready)
CREATE TABLE IF NOT EXISTS institutional_holdings (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id      text UNIQUE NOT NULL,
  ticker           text NOT NULL,
  institution_name text,
  shares           bigint,
  value_usd        bigint,
  quarter          date,
  change_shares    bigint,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS institutional_holdings_ticker_idx ON institutional_holdings (ticker);
ALTER TABLE institutional_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "institutional read" ON institutional_holdings FOR SELECT TO authenticated USING (true);

-- ── Dark pool prints (scaffold — wire Quiver / Unusual Whales when ready) ─────
CREATE TABLE IF NOT EXISTS dark_pool_trades (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id    text        UNIQUE NOT NULL,
  ticker         text        NOT NULL,
  price          numeric,
  volume         bigint,
  notional_value numeric,
  traded_at      timestamptz NOT NULL,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dark_pool_trades_ticker_idx    ON dark_pool_trades (ticker);
CREATE INDEX IF NOT EXISTS dark_pool_trades_traded_at_idx ON dark_pool_trades (traded_at DESC);
ALTER TABLE dark_pool_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "darkpool read" ON dark_pool_trades FOR SELECT TO authenticated USING (true);
