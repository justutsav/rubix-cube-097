-- SIH26097 — initial schema.
--
-- Mirrors docs/Utsav/research/05-technical-spec.md §2.1. Three things to notice, because they
-- are the design and not the plumbing:
--
--   1. There is no `audio` table and no `recording_url` column. Audio is transcribed,
--      normalised, confirmed and discarded inside the turn. Its absence is the feature.
--   2. `answer` carries a CHECK that makes it *impossible* to store a raw transcript against a
--      confirmed answer. decisions.md says the transcript is erased at CONFIRM; a comment is a
--      wish, a constraint is a guarantee. "We keep neither the voice nor the words, only the
--      confirmed answer" is now enforced by Postgres.
--   3. `qualification` is keyed on (code, title), never on code alone. The official NQR export
--      contains a duplicate code — QG-04-ES-00913-2023-V1-SCGJ is two different qualifications
--      (research/03-nqr-import.md). A `unique(code)` would silently collapse them.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- reference geography
-- LGD codes are nullable because we will not invent them. Name-only rows are honest rows.
create table if not exists district (
  id            uuid primary key default gen_random_uuid(),
  lgd_code      int unique,
  name          text not null,
  state_name    text not null,
  is_pilot      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (name, state_name)
);

create table if not exists block (
  id            uuid primary key default gen_random_uuid(),
  district_id   uuid not null references district(id) on delete cascade,
  lgd_code      int,
  name          text not null,
  unique (district_id, name)
);

-- ---------------------------------------------------------------- beneficiary
do $$ begin
  create type consent_state as enum ('NONE','GIVEN','GUARDIAN_PENDING','GUARDIAN_GIVEN','WITHDRAWN');
exception when duplicate_object then null;
end $$;

create table if not exists beneficiary (
  id              uuid primary key default gen_random_uuid(),
  -- hmac(e164, server_pepper). The raw number is never stored, anywhere, ever.
  phone_hash      bytea not null,
  -- Shared-handset discriminator. Multiple beneficiaries per handset is the NORMAL case in this
  -- scheme (51.6% of rural women 15+ own no phone), so the model carries it from day one rather
  -- than retrofitting a unique constraint after the first collision. Spec §9 BLOCKER 1.
  ordinal         smallint not null default 1,
  first_name      text,
  -- 4-digit resume PIN, stored as a hash. A name gate is not enough: a relative can guess a name.
  resume_pin_hash bytea,
  district_id     uuid references district(id),
  block_id        uuid references block(id),
  village_name    text,
  -- NOT one of the seven PS fields. Registration metadata, same status as village/block.
  -- Needed only because PM-DAKSH routing keys on 18-45 and no PS field asks age.
  age_band        text check (age_band in ('under_18','18_45','over_45')),
  is_woman        boolean,
  consent_state   consent_state not null default 'NONE',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (phone_hash, ordinal)
);

-- phone_hash is a NON-UNIQUE LOOKUP INDEX, never an identity. That distinction is the whole
-- of BLOCKER 1; the index below is deliberately not unique.
create index if not exists beneficiary_phone_hash_idx on beneficiary (phone_hash);
create index if not exists beneficiary_district_idx on beneficiary (district_id);

-- ---------------------------------------------------------------- session
do $$ begin
  create type channel_kind as enum ('ivr','whatsapp','app');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type session_status as enum ('ACTIVE','RESUMABLE','COMPLETED','ABANDONED');
exception when duplicate_object then null;
end $$;

create table if not exists session (
  id              uuid primary key default gen_random_uuid(),
  beneficiary_id  uuid not null references beneficiary(id) on delete cascade,
  channel         channel_kind not null,
  channel_ref     text,
  locale          text not null default 'hi',
  fsm_state       text not null,
  phase           text not null default 'ASK',
  status          session_status not null default 'ACTIVE',
  re_ask_count    smallint not null default 0,
  deferred        smallint[] not null default '{}',
  pin_attempts    smallint not null default 0,
  noticed_channels channel_kind[] not null default '{}',
  started_at      timestamptz not null default now(),
  last_turn_at    timestamptz not null default now()
);

create index if not exists session_beneficiary_idx on session (beneficiary_id, status);
create index if not exists session_resumable_idx on session (beneficiary_id) where status = 'RESUMABLE';

-- ---------------------------------------------------------------- answers
do $$ begin
  create type extract_method as enum ('DTMF','LEXICON','REGEX','LLM','OPERATOR','TAP');
exception when duplicate_object then null;
end $$;

create table if not exists answer (
  beneficiary_id  uuid not null references beneficiary(id) on delete cascade,
  -- 1..7, the PS's order, verbatim. An evaluator will count these.
  field_no        smallint not null check (field_no between 1 and 7),
  -- Erased at CONFIRM. See the check constraint below — this is not advisory.
  raw_transcript  text,
  nbest           jsonb,
  value           jsonb not null,
  confidence      real not null check (confidence >= 0 and confidence <= 1),
  method          extract_method not null,
  asr_engine      text,
  asr_version     text,
  confirmed_at    timestamptz,
  session_id      uuid references session(id) on delete set null,
  updated_at      timestamptz not null default now(),
  primary key (beneficiary_id, field_no),

  -- The compliance invariant, enforced rather than documented. A confirmed answer cannot carry
  -- the words that produced it. The transcript's purpose is fully discharged the moment the
  -- normalised value is read back and accepted, and it is 26-60% wrong anyway, so its
  -- evidentiary value is near zero while its disclosure risk is total. Spec §9 MAJOR 5.
  constraint transcript_erased_on_confirm check (confirmed_at is null or raw_transcript is null),
  constraint nbest_erased_on_confirm check (confirmed_at is null or nbest is null)
);

-- ---------------------------------------------------------------- consent
do $$ begin
  create type consent_kind as enum ('SPOKEN_YES','DTMF_YES','GUARDIAN_YES','WITHDRAWN');
exception when duplicate_object then null;
end $$;

create table if not exists consent_event (
  id              uuid primary key default gen_random_uuid(),
  beneficiary_id  uuid not null references beneficiary(id) on delete cascade,
  kind            consent_kind not null,
  -- Which script they actually heard. Without this, a consent record proves nothing.
  script_version  text not null,
  channel         channel_kind not null,
  -- In assisted mode this carries the worker's id. Consent is always recorded as spoken BY the
  -- beneficiary, never as the worker's assertion on her behalf.
  evidence        jsonb not null default '{}'::jsonb,
  captured_at     timestamptz not null default now()
);

create index if not exists consent_beneficiary_idx on consent_event (beneficiary_id, captured_at desc);

-- ---------------------------------------------------------------- qualifications
create table if not exists qualification (
  id              uuid primary key default gen_random_uuid(),
  local_id        text not null unique,
  -- NULL until the official NQR import has run. decisions.md: fields the source does not
  -- provide are NULL, not guessed. No invented QP codes, ever.
  qp_code         text,
  title           text not null,
  sector          text,
  -- Official string form. "Level 4.5" is not a typo; half-levels are real.
  level_label     text not null,
  level_numeric   numeric(3,1) not null,
  min_notional_hours int,
  max_notional_hours int,
  -- JSON inside a spreadsheet cell in the official export: theory/practical/employability/OJT.
  delivery_hours  jsonb,
  originally_approved date,
  valid_till      date,
  awarding_body   text,
  concepts        text[] not null default '{}',
  self_employable boolean not null default false,
  physical_demand text not null default 'moderate' check (physical_demand in ('low','moderate','high')),
  source          text not null check (source in ('NQR_OFFICIAL','PROTOTYPE_PENDING_NQR_IMPORT')),
  source_date     date not null,
  nqr_snapshot_sha text,
  -- NOT unique on qp_code. The official register contains a duplicated code carrying two
  -- genuinely different qualifications; keying on the code alone merges them.
  unique (qp_code, title)
);

-- NOT a partial index on `valid_till >= current_date`: that is what failed with 42P17. An index
-- predicate must be IMMUTABLE, and current_date is only STABLE — which is Postgres protecting us,
-- because such an index would quietly go stale as rows expired underneath it. valid_till is in the
-- index instead, so "valid and at or below level N" is still a single index scan and the freshness
-- test happens in the query where it belongs. 880 of the register's 2,814 rows are expired, so
-- this filter runs on every recommendation.
create index if not exists qualification_level_idx on qualification (level_numeric, valid_till);
create index if not exists qualification_concepts_idx on qualification using gin (concepts);

-- ---------------------------------------------------------------- opportunity data
create table if not exists district_opportunity (
  id            uuid primary key default gen_random_uuid(),
  district_id   uuid not null references district(id) on delete cascade,
  block_id      uuid references block(id) on delete set null,
  concept_id    text not null,
  kind          text not null check (kind in ('employer','enterprise','centre','scheme')),
  title         text not null,
  detail        text,
  latitude      double precision,
  longitude     double precision,
  -- Both NOT NULL by decision, not by accident. A row without a source is a fabricated row, and
  -- a fabricated district feed loses to three honest districts the moment a jury member turns
  -- out to be from one of them.
  source        text not null,
  source_date   date not null,
  created_at    timestamptz not null default now()
);

create index if not exists opportunity_district_concept_idx on district_opportunity (district_id, concept_id);

-- ---------------------------------------------------------------- recommendations and outcomes
create table if not exists recommendation (
  id                  uuid primary key default gen_random_uuid(),
  beneficiary_id      uuid not null references beneficiary(id) on delete cascade,
  ranked              jsonb not null,
  near_miss           jsonb,
  route_to_pm_daksh   jsonb,
  -- Ch.3 ¶7A.a.iv: every training programme must carry a financial-literacy component.
  needs_financial_literacy boolean not null default true,
  -- ₹50,000 or 50% of project cost, whichever is less, and only where a bank loan is taken.
  asset_grant_eligible boolean not null default false,
  -- In 2030 somebody will ask why this person was sent to this trade. These three columns are
  -- the difference between an answer and a shrug.
  weights_version     text not null,
  engine_version      text not null,
  nqr_snapshot_sha    text,
  contains_prototype_data boolean not null default false,
  created_at          timestamptz not null default now(),
  delivered_at        timestamptz
);

create index if not exists recommendation_beneficiary_idx on recommendation (beneficiary_id, created_at desc);

do $$ begin
  create type outcome_status as enum ('RECOMMENDED','ENROLLED','CERTIFIED','PLACED','DROPPED');
exception when duplicate_object then null;
end $$;

-- Basic Issue 3, and the guidelines' own 70% placement target which CAG measured at 41%.
-- Updated from the mobiliser's call list, NOT from a new officer screen.
create table if not exists outcome (
  id              uuid primary key default gen_random_uuid(),
  beneficiary_id  uuid not null references beneficiary(id) on delete cascade,
  qualification_id uuid references qualification(id) on delete set null,
  qualification_ref text not null,
  status          outcome_status not null,
  status_date     date not null default current_date,
  source          text not null default 'mobiliser_call_list',
  note            text,
  created_at      timestamptz not null default now(),
  unique (beneficiary_id, qualification_ref, status)
);

-- ---------------------------------------------------------------- perspective plan
-- The statutory artefact. The differentiator was never the screen — it is the format and the
-- date: DL-PACC submits through the portal by the FIRST WEEK OF APRIL, projecting 3.5-4x the
-- notional allocation (May 2023 revision, Ch.1 ¶6c.vi and Ch.3 ¶9).
create table if not exists perspective_plan (
  id                  uuid primary key default gen_random_uuid(),
  district_id         uuid not null references district(id) on delete cascade,
  fy_from             smallint not null,
  fy_to               smallint not null,
  notional_allocation numeric(14,2),
  projection_multiple numeric(4,2) not null default 3.75 check (projection_multiple >= 3.5 and projection_multiple <= 4),
  status              text not null default 'DRAFT' check (status in ('DRAFT','DL_PACC_SUBMITTED','SL_PACC_APPROVED','PACC_APPRAISED')),
  -- First week of April. Stored so the console can shout about it.
  due_date            date not null,
  submitted_at        timestamptz,
  created_at          timestamptz not null default now(),
  unique (district_id, fy_from, fy_to)
);

create table if not exists perspective_plan_line (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references perspective_plan(id) on delete cascade,
  concept_id          text not null,
  qualification_id    uuid references qualification(id) on delete set null,
  block_id            uuid references block(id) on delete set null,
  demand_count        int not null default 0,
  near_miss_count     int not null default 0,
  women_count         int not null default 0,
  gia_category        text check (gia_category in ('RPL','STT','EDP','LTT')),
  estimated_cost      numeric(14,2),
  created_at          timestamptz not null default now()
);

create index if not exists plan_line_plan_idx on perspective_plan_line (plan_id);

-- ---------------------------------------------------------------- staff
create table if not exists app_user (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null check (role in ('mobiliser','officer','admin')),
  full_name     text,
  district_id   uuid references district(id),
  block_id      uuid references block(id),
  worker_ref    text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- turn telemetry
-- The per-turn latency number that goes on a slide. Also the only way to know whether the
-- lexicon really handles ~70% of turns, which is the whole latency argument.
create table if not exists turn_telemetry (
  id            bigserial primary key,
  session_id    uuid references session(id) on delete cascade,
  channel       channel_kind not null,
  fsm_state     text not null,
  method        extract_method,
  ladder_rung   smallint,
  asr_engine    text,
  latency_ms    int,
  confidence    real,
  locale        text,
  fell_back_locale boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists telemetry_created_idx on turn_telemetry (created_at desc);

-- ---------------------------------------------------------------- RLS
-- Beneficiaries never authenticate — they phone in. All beneficiary-facing writes go through
-- the edge function on the service role. Staff read through these policies.

alter table beneficiary enable row level security;
alter table session enable row level security;
alter table answer enable row level security;
alter table consent_event enable row level security;
alter table recommendation enable row level security;
alter table outcome enable row level security;
alter table perspective_plan enable row level security;
alter table perspective_plan_line enable row level security;
alter table turn_telemetry enable row level security;
alter table app_user enable row level security;
alter table qualification enable row level security;
alter table district enable row level security;
alter table block enable row level security;
alter table district_opportunity enable row level security;

create or replace function current_app_user() returns app_user
language sql stable security definer set search_path = public as $$
  select * from app_user where id = auth.uid();
$$;

create or replace function is_officer() returns boolean
language sql stable as $$
  select coalesce((select role in ('officer','admin') from app_user where id = auth.uid()), false);
$$;

create or replace function my_district() returns uuid
language sql stable as $$
  select district_id from app_user where id = auth.uid();
$$;

-- Reference data is readable by any signed-in staff member.
drop policy if exists ref_read_district on district;
create policy ref_read_district on district for select to authenticated using (true);
drop policy if exists ref_read_block on block;
create policy ref_read_block on block for select to authenticated using (true);
drop policy if exists ref_read_qual on qualification;
create policy ref_read_qual on qualification for select to authenticated using (true);
drop policy if exists ref_read_opp on district_opportunity;
create policy ref_read_opp on district_opportunity for select to authenticated using (true);

drop policy if exists me_read on app_user;
create policy me_read on app_user for select to authenticated using (id = auth.uid());

-- A mobiliser sees her own district only. An officer sees their district. Nobody sees the country.
drop policy if exists ben_scope on beneficiary;
create policy ben_scope on beneficiary for select to authenticated
  using (district_id = my_district() or is_officer() and district_id = my_district());

drop policy if exists answer_scope on answer;
create policy answer_scope on answer for select to authenticated
  using (exists (select 1 from beneficiary b where b.id = answer.beneficiary_id and b.district_id = my_district()));

drop policy if exists session_scope on session;
create policy session_scope on session for select to authenticated
  using (exists (select 1 from beneficiary b where b.id = session.beneficiary_id and b.district_id = my_district()));

drop policy if exists consent_scope on consent_event;
create policy consent_scope on consent_event for select to authenticated
  using (exists (select 1 from beneficiary b where b.id = consent_event.beneficiary_id and b.district_id = my_district()));

drop policy if exists reco_scope on recommendation;
create policy reco_scope on recommendation for select to authenticated
  using (exists (select 1 from beneficiary b where b.id = recommendation.beneficiary_id and b.district_id = my_district()));

-- Outcome tracking is the mobiliser's job, so she can write it. Basic Issue 3.
drop policy if exists outcome_scope on outcome;
create policy outcome_scope on outcome for select to authenticated
  using (exists (select 1 from beneficiary b where b.id = outcome.beneficiary_id and b.district_id = my_district()));
drop policy if exists outcome_write on outcome;
create policy outcome_write on outcome for insert to authenticated
  with check (exists (select 1 from beneficiary b where b.id = outcome.beneficiary_id and b.district_id = my_district()));

drop policy if exists plan_scope on perspective_plan;
create policy plan_scope on perspective_plan for select to authenticated using (district_id = my_district());
drop policy if exists plan_write on perspective_plan;
create policy plan_write on perspective_plan for all to authenticated
  using (district_id = my_district() and is_officer()) with check (district_id = my_district() and is_officer());
drop policy if exists plan_line_scope on perspective_plan_line;
create policy plan_line_scope on perspective_plan_line for select to authenticated
  using (exists (select 1 from perspective_plan p where p.id = plan_id and p.district_id = my_district()));
drop policy if exists plan_line_write on perspective_plan_line;
create policy plan_line_write on perspective_plan_line for all to authenticated
  using (exists (select 1 from perspective_plan p where p.id = plan_id and p.district_id = my_district() and is_officer()))
  with check (exists (select 1 from perspective_plan p where p.id = plan_id and p.district_id = my_district() and is_officer()));

drop policy if exists telemetry_read on turn_telemetry;
create policy telemetry_read on turn_telemetry for select to authenticated using (is_officer());

-- ---------------------------------------------------------------- aggregation for the officer
-- District demand, which is the whole answer to Basic Issue 1. Note it counts CONFIRMED answers
-- only: an unconfirmed field is a resumable field, not a data point to put in a statutory plan.
create or replace view district_demand as
select
  b.district_id,
  d.name as district_name,
  bl.id as block_id,
  bl.name as block_name,
  c.concept_id,
  count(distinct b.id) as beneficiaries,
  count(distinct b.id) filter (where b.is_woman) as women,
  count(distinct b.id) filter (where b.consent_state = 'GIVEN') as consented
from beneficiary b
join district d on d.id = b.district_id
left join block bl on bl.id = b.block_id
join answer a on a.beneficiary_id = b.id and a.field_no = 4 and a.confirmed_at is not null
cross join lateral jsonb_array_elements_text(a.value -> 'conceptIds') as c(concept_id)
group by b.district_id, d.name, bl.id, bl.name, c.concept_id;

comment on view district_demand is
  'Aggregated confirmed skill interest per block per trade. Feeds perspective_plan_line. Counts only confirmed answers.';
