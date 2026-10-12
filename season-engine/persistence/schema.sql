-- Knight FM — season engine: esquema de persistencia (SQLite; portable a Postgres).
-- Claves, índices y restricciones únicas explícitas. Idempotencia: claves
-- deterministas + INSERT OR IGNORE en todos los escritores.

CREATE TABLE IF NOT EXISTS seasons (
  number      INTEGER PRIMARY KEY,
  seed        TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clubs (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  region   INTEGER NOT NULL CHECK (region BETWEEN 1 AND 10),
  division INTEGER NOT NULL CHECK (division BETWEEN 1 AND 10),
  UNIQUE (region, division, id)
);

CREATE TABLE IF NOT EXISTS waves (
  id        TEXT PRIMARY KEY,
  day       INTEGER NOT NULL,
  start_utc TEXT NOT NULL,
  end_utc   TEXT NOT NULL,
  lanes     INTEGER NOT NULL CHECK (lanes > 0)
);
CREATE INDEX IF NOT EXISTS ix_waves_day ON waves(day);

CREATE TABLE IF NOT EXISTS fixtures (
  id               TEXT PRIMARY KEY,           -- clave determinista del motor
  season           INTEGER NOT NULL REFERENCES seasons(number),
  competition      TEXT    NOT NULL CHECK (competition IN ('LIGA','COPA','MUNDIAL')),
  region           INTEGER,                    -- NULL = GLOBAL (Mundial)
  division         INTEGER,
  round            TEXT    NOT NULL,           -- J1..J30 | R1..R7,F | L1..L8,PO-I..F
  leg              INTEGER NOT NULL DEFAULT 0 CHECK (leg IN (0,1,2)),
  home             TEXT    NOT NULL,           -- id de club o 'TBD' (hueco reservado)
  away             TEXT    NOT NULL,
  day              INTEGER NOT NULL CHECK (day BETWEEN 1 AND 30),
  kickoff_utc      TEXT    NOT NULL,
  reserved_end_utc TEXT    NOT NULL,
  slot_id          TEXT    NOT NULL UNIQUE,
  wave_id          TEXT    NOT NULL REFERENCES waves(id),
  status           TEXT    NOT NULL DEFAULT 'SCHEDULED'
                   CHECK (status IN ('SCHEDULED','LOCKED','SIMULATING','FINISHED')),
  placeholder      INTEGER NOT NULL DEFAULT 0,
  sim_seed         TEXT    NOT NULL             -- semilla almacenada (auditoría/re-simulación)
);
-- unicidad de pareja SOLO para partidos reales (los placeholders TBD comparten valores)
CREATE UNIQUE INDEX IF NOT EXISTS ux_fixtures_pair
  ON fixtures(season, competition, round, leg, home, away) WHERE placeholder = 0;
CREATE INDEX IF NOT EXISTS ix_fixtures_day     ON fixtures(day, kickoff_utc);
CREATE INDEX IF NOT EXISTS ix_fixtures_due     ON fixtures(status, kickoff_utc);
CREATE INDEX IF NOT EXISTS ix_fixtures_team    ON fixtures(home, day);
CREATE INDEX IF NOT EXISTS ix_fixtures_team2   ON fixtures(away, day);

CREATE TABLE IF NOT EXISTS standings (
  season    INTEGER NOT NULL REFERENCES seasons(number),
  scope     TEXT    NOT NULL,          -- 'LIGA:R{r}D{d}' | 'MUNDIAL'
  team      TEXT    NOT NULL,
  position  INTEGER NOT NULL,
  pts       INTEGER NOT NULL,
  gf        INTEGER NOT NULL,
  ga        INTEGER NOT NULL,
  PRIMARY KEY (season, scope, team)
);

CREATE TABLE IF NOT EXISTS cup_runs (
  season          INTEGER NOT NULL REFERENCES seasons(number),
  region          INTEGER NOT NULL,
  round           TEXT    NOT NULL,
  home            TEXT    NOT NULL,
  away            TEXT    NOT NULL,
  winner          TEXT,                      -- NULL hasta jugarse
  pens            INTEGER,                   -- 1 si se decidieron por penaltis
  draw_seed       TEXT    NOT NULL,          -- semilla del sorteo de la ronda (auditoría)
  PRIMARY KEY (season, region, round, home, away)
);

CREATE TABLE IF NOT EXISTS wc_slots (
  season      INTEGER NOT NULL REFERENCES seasons(number),
  club_id     TEXT    NOT NULL,
  region      INTEGER NOT NULL,
  bombo       INTEGER NOT NULL CHECK (bombo BETWEEN 1 AND 4),
  source      TEXT    NOT NULL CHECK (source IN ('LIGA','COPA','RANKING')),
  PRIMARY KEY (season, club_id)
);

CREATE TABLE IF NOT EXISTS draws (
  season      INTEGER NOT NULL REFERENCES seasons(number),
  competition TEXT    NOT NULL,
  round       TEXT    NOT NULL,
  seed        TEXT    NOT NULL,
  payload     TEXT    NOT NULL,              -- resultado del sorteo serializado
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (season, competition, round)
);

CREATE TABLE IF NOT EXISTS movements (
  season        INTEGER NOT NULL REFERENCES seasons(number),
  club_id       TEXT    NOT NULL,
  from_division INTEGER NOT NULL,
  to_division   INTEGER NOT NULL,
  kind          TEXT    NOT NULL CHECK (kind IN ('ASCENSO','DESCENSO')),
  PRIMARY KEY (season, club_id)
);

CREATE TABLE IF NOT EXISTS job_runs (
  idempotency_key TEXT PRIMARY KEY,          -- p.ej. 'MATCH:<fixture-id>' | 'WAVE:<wave-id>'
  job_type        TEXT NOT NULL,
  outcome         TEXT NOT NULL CHECK (outcome IN ('OK','FAILED','SKIPPED')),
  detail          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
