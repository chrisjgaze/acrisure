-- =============================================================================
-- Initial schema migration — form-bloom-pro
-- Replicated from production on 2026-04-15
-- Run this once on any new Supabase project (e.g. staging) to set up the
-- complete schema including RLS policies.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ── 0. CLEAN SLATE (safe on empty/staging databases) ─────────────────────────
-- Drop all tables in reverse dependency order so FKs don't block the drops.
-- CASCADE handles any remaining dependencies automatically.
drop table if exists quote_comparisons           cascade;
drop table if exists insurer_quotes              cascade;
drop table if exists documents                   cascade;
drop table if exists audit_log                   cascade;
drop table if exists ai_import_sessions          cascade;
drop table if exists submission_custom_answers   cascade;
drop table if exists submission_terrorism        cascade;
drop table if exists submission_dno              cascade;
drop table if exists submission_cyber            cascade;
drop table if exists submission_turnover_by_country cascade;
drop table if exists submission_overdue_accounts cascade;
drop table if exists submission_debtor_distribution cascade;
drop table if exists submission_debtor_balances  cascade;
drop table if exists submission_loss_history     cascade;
drop table if exists submission_buyers           cascade;
drop table if exists submission_financial        cascade;
drop table if exists submission_company          cascade;
drop table if exists tenant_form_config          cascade;
drop table if exists tenant_custom_questions     cascade;
drop table if exists magic_links                 cascade;
drop table if exists submissions                 cascade;
drop table if exists clients                     cascade;
drop table if exists users                       cascade;
drop table if exists tenants                     cascade;

-- ── 1. TENANTS ────────────────────────────────────────────────────────────────
create table if not exists tenants (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null,
  logo_url         text,
  primary_colour   text,
  custom_domain    text,
  contact_email    text not null,
  is_active        boolean default true,
  deleted_at       timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table tenants enable row level security;
-- No policies: tenants table is accessed via service role only


-- ── 2. USERS ──────────────────────────────────────────────────────────────────
-- id mirrors auth.users — no default, set on insert from auth.uid()
create table if not exists users (
  id               uuid primary key references auth.users(id),
  tenant_id        uuid references tenants(id),
  role             text not null,
  first_name       text,
  last_name        text,
  email            text not null,
  is_active        boolean default true,
  deleted_at       timestamptz,
  last_login       timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  licensed_classes text[] default '{trade_credit}'::text[],
  is_admin         boolean default false
);

alter table users enable row level security;

create policy "users_read_own"
  on users for select
  using (auth.uid() = id);

-- ── 2A. BOOTSTRAP PLATFORM ADMIN ─────────────────────────────────────────────
-- Creates a first-login admin user for new environments.
-- Change this password immediately after first login.
do $$
declare
  bootstrap_tenant_id constant uuid := '00000000-0000-4000-8000-000000000001';
  bootstrap_user_id   constant uuid := '00000000-0000-4000-8000-000000000002';
  bootstrap_email     constant text := 'chrisjgaze@gmail.com';
  bootstrap_password  constant text := 'TempAdmin#2026!Bloom';
begin
  insert into tenants (
    id,
    name,
    slug,
    contact_email,
    primary_colour,
    is_active
  )
  values (
    bootstrap_tenant_id,
    'Platform',
    'platform',
    bootstrap_email,
    '#041240',
    true
  )
  on conflict (id) do update
    set name = excluded.name,
        slug = excluded.slug,
        contact_email = excluded.contact_email,
        primary_colour = excluded.primary_colour,
        updated_at = now();

  if not exists (
    select 1 from auth.users where id = bootstrap_user_id or email = bootstrap_email
  ) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      bootstrap_user_id,
      'authenticated',
      'authenticated',
      bootstrap_email,
      extensions.crypt(bootstrap_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('first_name', 'Platform', 'last_name', 'Admin'),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      bootstrap_user_id,
      jsonb_build_object(
        'sub', bootstrap_user_id::text,
        'email', bootstrap_email
      ),
      'email',
      bootstrap_email,
      now(),
      now(),
      now()
    );
  end if;

  insert into users (
    id,
    tenant_id,
    role,
    first_name,
    last_name,
    email,
    is_active,
    licensed_classes,
    is_admin
  )
  values (
    bootstrap_user_id,
    bootstrap_tenant_id,
    'platform_admin',
    'Platform',
    'Admin',
    bootstrap_email,
    true,
    '{trade_credit,cyber,dno,terrorism}'::text[],
    true
  )
  on conflict (id) do update
    set tenant_id = excluded.tenant_id,
        role = excluded.role,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        email = excluded.email,
        is_active = excluded.is_active,
        licensed_classes = excluded.licensed_classes,
        is_admin = excluded.is_admin,
        updated_at = now();
end
$$;


-- ── 3. CLIENTS ────────────────────────────────────────────────────────────────
create table if not exists clients (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id),
  assigned_broker_id  uuid references users(id),
  display_name        text,
  is_active           boolean default true,
  deleted_at          timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  contact_name        text,
  contact_email       text,
  renewal_date        date
);

alter table clients enable row level security;

create policy "Brokers can view own tenant clients"
  on clients for select
  using (tenant_id = (select tenant_id from users where id = auth.uid()));


-- ── 4. SUBMISSIONS ────────────────────────────────────────────────────────────
create table if not exists submissions (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references clients(id),
  tenant_id                uuid not null references tenants(id),
  reference                text not null,
  status                   text not null default 'not_started',
  policy_year              integer not null,
  renewal_date             date,
  last_activity            timestamptz,
  completion_pct           integer default 0,
  submitted_at             timestamptz,
  submitted_by             uuid references users(id),
  declaration_accepted     boolean default false,
  declaration_accepted_at  timestamptz,
  declaration_accepted_by  uuid references users(id),
  declaration_ip           text,
  pdf_url                  text,
  deleted_at               timestamptz,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now(),
  class_of_business        text not null default 'trade_credit'
);

alter table submissions enable row level security;

create policy "broker_tenant_isolation"
  on submissions for all
  using (
    tenant_id = (select tenant_id from users where id = auth.uid())
    and deleted_at is null
  );

create policy "platform_admin_all"
  on submissions for all
  using (
    (select role from users where id = auth.uid()) = 'platform_admin'
  );

create policy "client_isolation"
  on submissions for all
  using (
    client_id in (
      select clients.id from clients
      where clients.id = (select client_id from users where id = auth.uid())
    )
    and deleted_at is null
  );


-- ── 5. MAGIC LINKS ────────────────────────────────────────────────────────────
create table if not exists magic_links (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null,
  client_id     uuid not null references clients(id),
  submission_id uuid references submissions(id),
  email         text not null,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz default now()
);

alter table magic_links enable row level security;

create policy "Allow anon to read magic links for policy evaluation"
  on magic_links for select
  using (true);

-- Magic link policies on submissions must be created after magic_links exists
create policy "Magic link clients can read own submission"
  on submissions for select
  using (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submissions.id
        and magic_links.expires_at > now()
    )
  );

create policy "Magic link clients can update own submission"
  on submissions for update
  using (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submissions.id
        and magic_links.expires_at > now()
    )
  )
  with check (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submissions.id
        and magic_links.expires_at > now()
    )
  );


-- ── 6. TENANT CONFIG TABLES ───────────────────────────────────────────────────
create table if not exists tenant_custom_questions (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id),
  section        text not null,
  question_type  text not null,
  question_label text not null,
  helper_text    text,
  is_required    boolean default false,
  options        jsonb,
  sort_order     integer default 0,
  is_active      boolean default true,
  deleted_at     timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table tenant_custom_questions enable row level security;
-- No policies: accessed via service role only


create table if not exists tenant_form_config (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references tenants(id),
  declaration_custom_wording  text,
  data_protection_wording     text,
  post_submission_message     text,
  show_debt_collection_field  boolean default true,
  show_current_broker_field   boolean default true,
  show_credit_status_fields   boolean default true,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

alter table tenant_form_config enable row level security;
-- No policies: accessed via service role only


-- ── 7. SUBMISSION DATA TABLES ─────────────────────────────────────────────────

create table if not exists submission_company (
  id                         uuid primary key default gen_random_uuid(),
  submission_id              uuid not null references submissions(id),
  company_name               text,
  address_line1              text,
  address_line2              text,
  city                       text,
  postcode                   text,
  country                    text default 'GB',
  trading_address_different  boolean default false,
  trading_address_line1      text,
  trading_address_line2      text,
  trading_city               text,
  trading_postcode           text,
  website                    text,
  company_reg_number         text,
  vat_number                 text,
  formation_date             date,
  contact_name               text,
  contact_position           text,
  contact_telephone          text,
  contact_email              text,
  nature_of_business         text,
  capacity                   text,
  trade_sectors              text[],
  debt_collection_provider   text,
  current_broker             text,
  created_at                 timestamptz default now(),
  updated_at                 timestamptz default now()
);

alter table submission_company enable row level security;

create policy "Magic link clients can upsert own company data"
  on submission_company for all
  using (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_company.submission_id
        and magic_links.expires_at > now()
    )
  )
  with check (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_company.submission_id
        and magic_links.expires_at > now()
    )
  );


create table if not exists submission_financial (
  id                          uuid primary key default gen_random_uuid(),
  submission_id               uuid not null references submissions(id),
  currency                    text default 'GBP',
  invoicing_deadline          text,
  credit_status_provider      text,
  credit_status_expiry        date,
  currently_insured           boolean,
  insurer_name                text,
  insurer_renewal_date        date,
  has_invoice_discounting     boolean,
  factoring_company           text,
  factoring_notice_period     text,
  has_seasonal_peaks          boolean,
  seasonal_peaks_detail       text,
  has_consignment_stock       boolean,
  consignment_stock_detail    text,
  has_long_term_contracts     boolean,
  long_term_contracts_detail  text,
  has_contra_payments         boolean,
  contra_payments_detail      text,
  has_paid_when_paid          boolean,
  paid_when_paid_detail       text,
  has_wip_pre_credit          boolean,
  wip_pre_credit_detail       text,
  has_retention_of_title      boolean,
  retention_of_title_detail   text,
  has_work_on_site            boolean,
  work_on_site_detail         text,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

alter table submission_financial enable row level security;

create policy "Magic link clients can upsert own financial data"
  on submission_financial for all
  using (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_financial.submission_id
        and magic_links.expires_at > now()
    )
  )
  with check (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_financial.submission_id
        and magic_links.expires_at > now()
    )
  );


create table if not exists submission_buyers (
  id                     uuid primary key default gen_random_uuid(),
  submission_id          uuid not null references submissions(id),
  buyer_name             text not null,
  address                text,
  street_name            text,
  street_number          text,
  postcode               text,
  town                   text,
  state                  text,
  country_code           text,
  id_type                text,
  id_value               text,
  currency               text,
  credit_limit_requested numeric,
  additional_comments    text,
  imported_via_ai        boolean default false,
  import_batch_id        uuid,
  sort_order             integer default 0,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

alter table submission_buyers enable row level security;

create policy "Magic link clients can upsert own buyer data"
  on submission_buyers for all
  using (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_buyers.submission_id
        and magic_links.expires_at > now()
    )
  )
  with check (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_buyers.submission_id
        and magic_links.expires_at > now()
    )
  );


create table if not exists submission_loss_history (
  id                     uuid primary key default gen_random_uuid(),
  submission_id          uuid not null references submissions(id),
  financial_year_ending  date,
  turnover               numeric,
  net_bad_debt_losses    numeric,
  number_of_losses       integer,
  largest_individual_loss numeric,
  largest_loss_name      text,
  sort_order             integer default 0,
  created_at             timestamptz default now()
);

alter table submission_loss_history enable row level security;

create policy "Magic link clients can upsert own loss history data"
  on submission_loss_history for all
  using (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_loss_history.submission_id
        and magic_links.expires_at > now()
    )
  )
  with check (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_loss_history.submission_id
        and magic_links.expires_at > now()
    )
  );


create table if not exists submission_debtor_balances (
  id                   uuid primary key default gen_random_uuid(),
  submission_id        uuid not null references submissions(id),
  balance_31_march     numeric,
  balance_30_june      numeric,
  balance_30_september numeric,
  balance_31_december  numeric,
  current_total        numeric,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table submission_debtor_balances enable row level security;

create policy "Magic link clients can upsert own debtor balances data"
  on submission_debtor_balances for all
  using (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_debtor_balances.submission_id
        and magic_links.expires_at > now()
    )
  )
  with check (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_debtor_balances.submission_id
        and magic_links.expires_at > now()
    )
  );


create table if not exists submission_debtor_distribution (
  id                  uuid primary key default gen_random_uuid(),
  submission_id       uuid not null references submissions(id),
  debt_band           text not null,
  number_of_debtors   integer,
  debtor_balance_pct  numeric,
  created_at          timestamptz default now()
);

alter table submission_debtor_distribution enable row level security;

create policy "Magic link clients can upsert own debtor distribution data"
  on submission_debtor_distribution for all
  using (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_debtor_distribution.submission_id
        and magic_links.expires_at > now()
    )
  )
  with check (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_debtor_distribution.submission_id
        and magic_links.expires_at > now()
    )
  );


create table if not exists submission_overdue_accounts (
  id                 uuid primary key default gen_random_uuid(),
  submission_id      uuid not null references submissions(id),
  customer_name      text,
  address_or_reg     text,
  amount_outstanding numeric,
  due_date           date,
  action_taken       text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

alter table submission_overdue_accounts enable row level security;

create policy "Magic link clients can upsert own overdue accounts data"
  on submission_overdue_accounts for all
  using (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_overdue_accounts.submission_id
        and magic_links.expires_at > now()
    )
  )
  with check (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_overdue_accounts.submission_id
        and magic_links.expires_at > now()
    )
  );


create table if not exists submission_turnover_by_country (
  id                   uuid primary key default gen_random_uuid(),
  submission_id        uuid not null references submissions(id),
  country_of_trade     text not null,
  annual_turnover      numeric,
  number_of_accounts   integer,
  normal_payment_terms text,
  max_payment_terms    text,
  sort_order           integer default 0,
  created_at           timestamptz default now()
);

alter table submission_turnover_by_country enable row level security;

create policy "Magic link clients can upsert own turnover data"
  on submission_turnover_by_country for all
  using (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_turnover_by_country.submission_id
        and magic_links.expires_at > now()
    )
  )
  with check (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_turnover_by_country.submission_id
        and magic_links.expires_at > now()
    )
  );


create table if not exists submission_cyber (
  id                         uuid primary key default gen_random_uuid(),
  submission_id              uuid not null references submissions(id),
  cyber_essentials_certified boolean,
  cyber_essentials_plus      boolean,
  mfa_all_remote_access      boolean,
  patching_policy            boolean,
  offsite_backups            boolean,
  edr_software               boolean,
  incident_response_plan     boolean,
  suffered_breach            boolean,
  breach_details             text,
  annual_revenue_cyber       numeric,
  personal_data_records      text,
  processes_payment_cards    boolean,
  created_at                 timestamptz default now(),
  updated_at                 timestamptz default now()
);

alter table submission_cyber enable row level security;

create policy "submission_cyber_client_access"
  on submission_cyber for all
  using (
    submission_id in (
      select s.id from submissions s
      join clients c on c.id = s.client_id
      join magic_links ml on ml.client_id = c.id
      where ml.expires_at > now()
    )
  );


create table if not exists submission_dno (
  id                             uuid primary key default gen_random_uuid(),
  submission_id                  uuid not null references submissions(id),
  number_of_directors            integer,
  company_listed                 boolean,
  director_disqualified          boolean,
  director_disqualified_details  text,
  pending_claims                 boolean,
  pending_claims_details         text,
  annual_turnover_dno            numeric,
  net_assets                     numeric,
  has_audit_committee            boolean,
  recent_acquisitions            boolean,
  recent_acquisitions_details    text,
  created_at                     timestamptz default now(),
  updated_at                     timestamptz default now()
);

alter table submission_dno enable row level security;

create policy "submission_dno_client_access"
  on submission_dno for all
  using (
    submission_id in (
      select s.id from submissions s
      join clients c on c.id = s.client_id
      join magic_links ml on ml.client_id = c.id
      where ml.expires_at > now()
    )
  );


create table if not exists submission_terrorism (
  id                         uuid primary key default gen_random_uuid(),
  submission_id              uuid not null references submissions(id),
  property_address           text,
  construction_type          text,
  year_of_construction       integer,
  sum_insured                numeric,
  near_landmark              boolean,
  occupancy_type             text,
  existing_terrorism_cover   boolean,
  existing_cover_details     text,
  created_at                 timestamptz default now(),
  updated_at                 timestamptz default now(),
  annual_turnover_terrorism  numeric
);

alter table submission_terrorism enable row level security;

create policy "submission_terrorism_client_access"
  on submission_terrorism for all
  using (
    submission_id in (
      select s.id from submissions s
      join clients c on c.id = s.client_id
      join magic_links ml on ml.client_id = c.id
      where ml.expires_at > now()
    )
  );


create table if not exists submission_custom_answers (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references submissions(id),
  question_id     uuid not null references tenant_custom_questions(id),
  answer_text     text,
  answer_boolean  boolean,
  answer_number   numeric,
  answer_date     date,
  answer_options  text[],
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table submission_custom_answers enable row level security;

create policy "Magic link clients can upsert own custom answers data"
  on submission_custom_answers for all
  using (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_custom_answers.submission_id
        and magic_links.expires_at > now()
    )
  )
  with check (
    exists (
      select 1 from magic_links
      where magic_links.submission_id = submission_custom_answers.submission_id
        and magic_links.expires_at > now()
    )
  );


-- ── 8. SUPPORTING TABLES ──────────────────────────────────────────────────────

create table if not exists ai_import_sessions (
  id                uuid primary key default gen_random_uuid(),
  submission_id     uuid not null references submissions(id),
  target_table      text not null,
  original_headers  text[],
  mapping_result    jsonb,
  confidence_scores jsonb,
  user_overrides    jsonb,
  rows_imported     integer,
  rows_rejected     integer,
  created_at        timestamptz default now()
);

alter table ai_import_sessions enable row level security;
-- No policies: accessed via service role only


create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id),
  user_id       uuid references users(id),
  tenant_id     uuid not null references tenants(id),
  event_type    text not null,
  event_detail  jsonb,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz default now()
);

alter table audit_log enable row level security;
-- No policies: write-only via service role; reads for admins to be added later


create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id),
  tenant_id     uuid not null references tenants(id),
  document_type text not null,
  file_name     text not null,
  storage_path  text not null,
  generated_at  timestamptz default now(),
  generated_by  uuid references users(id),
  emailed_to    text[],
  emailed_at    timestamptz
);

alter table documents enable row level security;
-- No policies: accessed via service role only


create table if not exists insurer_quotes (
  id                     uuid primary key default gen_random_uuid(),
  submission_id          uuid not null references submissions(id),
  insurer_name           text,
  premium                numeric,
  coverage_pct           numeric,
  policy_type            text,
  credit_limits_approved jsonb,
  key_exclusions         text[],
  insurer_rating         text,
  quote_date             date,
  valid_until            date,
  raw_quote_pdf_url      text,
  notes                  text,
  created_at             timestamptz default now()
);

alter table insurer_quotes enable row level security;
-- No policies: accessed via service role only


create table if not exists quote_comparisons (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id),
  client_id          uuid not null references clients(id),
  class_of_business  text not null,
  insurer_labels     text[] not null,
  result             jsonb not null,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id)
);

alter table quote_comparisons enable row level security;

create policy "Brokers can read tenant comparisons"
  on quote_comparisons for select
  using (tenant_id = (select tenant_id from users where id = auth.uid()));

create policy "Brokers can insert comparisons"
  on quote_comparisons for insert
  with check (tenant_id = (select tenant_id from users where id = auth.uid()));
