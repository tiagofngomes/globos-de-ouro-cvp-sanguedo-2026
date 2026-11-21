-- =============================================================================
--  Globos de Ouro CVP Sanguedo 2026 — esquema da base de dados (Supabase)
-- =============================================================================
--  Princípios:
--   * Todas as regras (datas, fases, voto único, validação) vivem aqui, no
--     servidor. O relógio do telemóvel nunca é usado para decidir nada.
--   * ANONIMATO: a tabela que regista QUEM votou (vote_participation) não tem
--     qualquer ligação à tabela que regista OS VOTOS (vote_tallies). Os votos
--     são guardados apenas como contagens agregadas por candidato — não existe
--     nenhum "boletim" individual que possa ser associado a uma pessoa, nem
--     carimbos temporais que permitam correlações.
--   * O cliente (anon) não tem acesso direto a nenhuma tabela: apenas a
--     funções RPC específicas, com validação e limitação de tentativas.
--   * Administradores: utilizadores do Supabase Auth registados em `admins`.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------

-- Normalização de nomes (sem acentos, minúsculas, espaços simples).
create or replace function public.normalize_name(p text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, ''))), '\s+', ' ', 'g')
$$;

-- Normalização de números de membro (sem espaços, maiúsculas).
create or replace function public.normalize_member_number(p text)
returns text
language sql
immutable
parallel safe
as $$
  select upper(regexp_replace(coalesce(p, ''), '\s+', '', 'g'))
$$;

create or replace function public.sha256_hex(p text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(coalesce(p, ''), 'sha256'), 'hex')
$$;

-- IP do pedido (fornecido pelo PostgREST/Supabase nos cabeçalhos).
create or replace function public.request_ip()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1)), ''),
    nullif(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', ''),
    'desconhecido'
  )
$$;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Configuração do evento (linha única).
create table if not exists public.event_settings (
  id                     boolean primary key default true check (id),
  phase1_opens_at        timestamptz not null default (timestamp '2026-11-20 00:00:00' at time zone 'Europe/Lisbon'),
  phase1_closes_at       timestamptz not null default (timestamp '2026-12-10 23:59:59' at time zone 'Europe/Lisbon'),
  phase2_opens_at        timestamptz not null default (timestamp '2026-12-11 00:00:00' at time zone 'Europe/Lisbon'),
  phase2_closes_at       timestamptz,               -- definida posteriormente pelo administrador
  gala_at                timestamptz,               -- data da gala (opcional, para contagem decrescente)
  voting_paused          boolean not null default false,
  finalists_per_category integer not null default 5 check (finalists_per_category between 1 and 20),
  finalists_confirmed    boolean not null default false,
  finalists_confirmed_at timestamptz,
  results_published      boolean not null default false,
  updated_at             timestamptz not null default now()
);
insert into public.event_settings (id) values (true) on conflict (id) do nothing;

-- As fases nunca se sobrepõem, venha a alteração de onde vier:
-- abertura da 1ª < fecho da 1ª <= abertura da 2ª < fecho da 2ª (se definido).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'event_settings_dates_order') then
    alter table public.event_settings add constraint event_settings_dates_order check (
      phase1_opens_at < phase1_closes_at
      and phase1_closes_at <= phase2_opens_at
      and (phase2_closes_at is null or phase2_closes_at > phase2_opens_at)
    );
  end if;
end
$$;

-- Os resultados só podem ser publicados a partir do dia da gala (hora de Lisboa),
-- para ninguém os publicar por engano mais cedo. Ocultar é sempre possível.
create or replace function public.guard_results_publication()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.results_published and not coalesce(old.results_published, false) then
    if new.gala_at is null
       or (now() at time zone 'Europe/Lisbon')::date < (new.gala_at at time zone 'Europe/Lisbon')::date then
      raise exception 'Os resultados só podem ser publicados a partir do dia da gala.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists guard_results_publication on public.event_settings;
create trigger guard_results_publication
  before update on public.event_settings
  for each row execute function public.guard_results_publication();

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null default '',
  icon        text not null default 'trophy',
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.candidates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 1),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists candidates_name_normalized_key on public.candidates (public.normalize_name(name));

-- Números de membro autorizados. Nunca colocar estes números no repositório.
create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  member_number text not null unique check (member_number = public.normalize_member_number(member_number) and length(member_number) > 0),
  active        boolean not null default true,
  -- Preparado para autenticação adicional futura (ex.: PIN entregue em mão).
  -- Se preenchido, o PIN passa a ser obrigatório para votar.
  pin_hash      text,
  has_pin       boolean generated always as (pin_hash is not null) stored,
  created_at    timestamptz not null default now()
);

-- QUEM votou em cada fase. Sem carimbo temporal e sem ligação aos votos.
-- A chave primária impede votos duplicados, incluindo pedidos simultâneos.
create table if not exists public.vote_participation (
  -- restrict: um membro que já votou não pode ser apagado (e reintroduzido
  -- para votar outra vez); deve ser desativado.
  member_id uuid not null references public.members (id) on delete restrict,
  phase     smallint not null check (phase in (1, 2)),
  primary key (member_id, phase)
);

-- OS VOTOS: apenas contagens agregadas. Impossível saber quem votou em quem.
create table if not exists public.vote_tallies (
  phase        smallint not null check (phase in (1, 2)),
  -- restrict: categorias/candidatos com votos não podem ser apagados (só desativados).
  category_id  uuid not null references public.categories (id) on delete restrict,
  candidate_id uuid not null references public.candidates (id) on delete restrict,
  votes        integer not null default 0 check (votes >= 0),
  primary key (phase, category_id, candidate_id)
);

-- Finalistas de cada categoria (apurados a partir da 1.ª fase).
create table if not exists public.finalists (
  category_id  uuid not null references public.categories (id) on delete restrict,
  candidate_id uuid not null references public.candidates (id) on delete restrict,
  phase1_votes integer not null default 0,
  primary key (category_id, candidate_id)
);

-- Sessões de votação temporárias (o token só é guardado em hash).
create table if not exists public.voting_sessions (
  token_hash text primary key,
  member_id  uuid not null references public.members (id) on delete cascade,
  phase      smallint not null check (phase in (1, 2)),
  expires_at timestamptz not null
);
create index if not exists voting_sessions_member_idx on public.voting_sessions (member_id);

-- Registo de tentativas de acesso (para limitar ataques por tentativa e erro).
create table if not exists public.access_attempts (
  id          bigint generated always as identity primary key,
  ip          text not null,
  member_hash text not null,
  success     boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists access_attempts_ip_idx on public.access_attempts (ip, created_at);
create index if not exists access_attempts_member_idx on public.access_attempts (member_hash, created_at);

-- -----------------------------------------------------------------------------
-- Segurança: RLS
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

alter table public.admins             enable row level security;
alter table public.event_settings     enable row level security;
alter table public.categories         enable row level security;
alter table public.candidates         enable row level security;
alter table public.members            enable row level security;
alter table public.vote_participation enable row level security;
alter table public.vote_tallies       enable row level security;
alter table public.finalists          enable row level security;
alter table public.voting_sessions    enable row level security;
alter table public.access_attempts    enable row level security;

drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins for select to authenticated using (user_id = auth.uid());

drop policy if exists admin_all on public.event_settings;
create policy admin_all on public.event_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.categories;
create policy admin_all on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.candidates;
create policy admin_all on public.candidates for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.members;
create policy admin_all on public.members for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- vote_tallies: sem leitura direta, nem para administradores. Os totais só são
-- consultados através de admin_results(), que os esconde enquanto a fase está aberta.
drop policy if exists admin_read on public.vote_tallies;
drop policy if exists admin_read on public.finalists;
create policy admin_read on public.finalists for select to authenticated using (public.is_admin());
-- vote_participation, voting_sessions e access_attempts: sem políticas →
-- inacessíveis diretamente, até para administradores.

-- Privilégios explícitos: funciona quer o projeto conceda acesso automático às
-- novas tabelas ("Grant API access to new tables automatically") quer não.
-- Visitantes (anon) não acedem a nenhuma tabela: tudo passa pelas funções.
revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.event_settings to authenticated;
grant select, insert, update, delete on public.categories, public.candidates to authenticated;
grant select on public.admins, public.finalists to authenticated;

-- O PIN nunca é devolvido ao cliente, nem a administradores: privilégios por coluna.
grant select (id, member_number, active, has_pin, created_at) on public.members to authenticated;
grant insert (member_number, active) on public.members to authenticated;
grant update (active) on public.members to authenticated;
grant delete on public.members to authenticated;
-- vote_participation, voting_sessions e access_attempts: sem privilégios nem políticas.

-- -----------------------------------------------------------------------------
-- Lógica de fases (sempre com a hora do servidor)
-- -----------------------------------------------------------------------------

create or replace function public.compute_phase(s public.event_settings)
returns text
language sql
stable
as $$
  select case
    when s.results_published                          then 'results'
    when now() < s.phase1_opens_at                    then 'pre_voting'
    when now() <= s.phase1_closes_at                  then case when s.voting_paused then 'paused' else 'phase1' end
    when not s.finalists_confirmed
      or now() < s.phase2_opens_at                    then 'counting'
    when s.phase2_closes_at is null
      or now() <= s.phase2_closes_at                  then case when s.voting_paused then 'paused' else 'phase2' end
    else 'awaiting_gala'
  end
$$;

-- Proposta de finalistas: ranking da 1.ª fase com deteção de empates na
-- última posição de acesso à final.
create or replace function public.finalist_proposal()
returns table (
  category_id  uuid,
  candidate_id uuid,
  candidate_name text,
  votes        integer,
  rank_pos     integer,
  status       text      -- 'qualified' | 'tied' | 'out'
)
language sql
stable
security definer
set search_path = public
as $$
  with s as (select finalists_per_category as n from public.event_settings limit 1),
  ranked as (
    select t.category_id, t.candidate_id, c.name as candidate_name, t.votes,
           row_number() over (partition by t.category_id order by t.votes desc, c.name) as rn
    from public.vote_tallies t
    join public.candidates c on c.id = t.candidate_id
    join public.categories k on k.id = t.category_id and k.active
    where t.phase = 1 and t.votes > 0
  ),
  cutoff as (
    select r.category_id, r.votes as cut_votes
    from ranked r, s
    where r.rn = s.n
  ),
  counts as (
    select r.category_id,
           count(*) filter (where r.votes >= coalesce(cu.cut_votes, 0)) as at_or_above
    from ranked r
    left join cutoff cu on cu.category_id = r.category_id
    group by r.category_id
  )
  select r.category_id, r.candidate_id, r.candidate_name, r.votes, r.rn::integer,
         case
           when cu.cut_votes is null                         then 'qualified'          -- menos de N candidatos votados
           when r.votes > cu.cut_votes                       then 'qualified'
           when r.votes = cu.cut_votes and co.at_or_above > s.n then 'tied'            -- empate na última vaga
           when r.votes = cu.cut_votes                       then 'qualified'
           else 'out'
         end
  from ranked r
  cross join s
  left join cutoff cu on cu.category_id = r.category_id
  left join counts co on co.category_id = r.category_id
  order by r.category_id, r.rn
$$;

-- Apuramento automático: só confirma se não existirem empates.
-- Devolve a lista de categorias com empate (vazia se tudo correu bem).
create or replace function public.try_auto_finalize()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.event_settings;
  tied jsonb;
begin
  select * into s from public.event_settings where id for update;
  if s.finalists_confirmed then
    return jsonb_build_object('confirmed', true, 'ties', '[]'::jsonb);
  end if;
  if now() <= s.phase1_closes_at then
    return jsonb_build_object('confirmed', false, 'ties', '[]'::jsonb, 'reason', 'phase1_open');
  end if;

  select coalesce(jsonb_agg(distinct p.category_id), '[]'::jsonb) into tied
  from public.finalist_proposal() p where p.status = 'tied';

  if jsonb_array_length(tied) > 0 then
    return jsonb_build_object('confirmed', false, 'ties', tied);
  end if;

  delete from public.finalists where true; -- "where" obrigatório no Supabase (safeupdate)
  insert into public.finalists (category_id, candidate_id, phase1_votes)
  select p.category_id, p.candidate_id, p.votes from public.finalist_proposal() p where p.status = 'qualified';

  update public.event_settings
     set finalists_confirmed = true, finalists_confirmed_at = now(), updated_at = now()
   where id;
  return jsonb_build_object('confirmed', true, 'ties', '[]'::jsonb);
end
$$;

-- -----------------------------------------------------------------------------
-- RPC públicas
-- -----------------------------------------------------------------------------

create or replace function public.get_public_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.event_settings;
  ph text;
begin
  select * into s from public.event_settings where id;
  ph := public.compute_phase(s);

  -- Abertura automática da final às 00h00 de 11/12 (se não houver empates).
  if ph = 'counting' and not s.finalists_confirmed and now() >= s.phase2_opens_at then
    perform public.try_auto_finalize();
    select * into s from public.event_settings where id;
    ph := public.compute_phase(s);
  end if;

  return jsonb_build_object(
    'server_now',        now(),
    'phase',             ph,
    'phase1_opens_at',   s.phase1_opens_at,
    'phase1_closes_at',  s.phase1_closes_at,
    'phase2_opens_at',   s.phase2_opens_at,
    'phase2_closes_at',  s.phase2_closes_at,
    'gala_at',           s.gala_at,
    'finalists_per_category', s.finalists_per_category,
    'codes_numeric', not exists (select 1 from public.members m where m.active and m.member_number !~ '^[0-9]+$'),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'slug', c.slug, 'name', c.name,
               'description', c.description, 'icon', c.icon, 'sort_order', c.sort_order)
             order by c.sort_order, c.name)
      from public.categories c where c.active), '[]'::jsonb)
  );
end
$$;

-- Passo 1 da votação: valida o número de membro e abre uma sessão temporária.
-- Devolve sempre JSON (nunca exceções) para que as tentativas falhadas fiquem
-- registadas e contem para a limitação de tentativas.
create or replace function public.start_voting_session(p_member_number text, p_pin text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ip      text := public.request_ip();
  v_number  text := public.normalize_member_number(p_member_number);
  v_hash    text := public.sha256_hex(v_number);
  v_member  public.members;
  v_s       public.event_settings;
  v_phase   text;
  v_phase_n smallint;
  v_token   text;
  v_expires timestamptz := now() + interval '45 minutes';
  ip_fails  integer;
  num_fails integer;
begin
  -- Limpeza oportunista de registos antigos.
  delete from public.access_attempts where created_at < now() - interval '2 days';
  delete from public.voting_sessions where expires_at < now();

  select count(*) into ip_fails from public.access_attempts
   where ip = v_ip and not success and created_at > now() - interval '15 minutes';
  select count(*) into num_fails from public.access_attempts
   where member_hash = v_hash and not success and created_at > now() - interval '15 minutes';

  if ip_fails >= 10 or num_fails >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  select * into v_s from public.event_settings where id;
  v_phase := public.compute_phase(v_s);
  if v_phase not in ('phase1', 'phase2') then
    return jsonb_build_object('ok', false, 'error', 'voting_closed', 'phase', v_phase);
  end if;
  v_phase_n := case when v_phase = 'phase1' then 1 else 2 end;

  if length(v_number) = 0 or length(v_number) > 32 then
    insert into public.access_attempts (ip, member_hash, success) values (v_ip, v_hash, false);
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select * into v_member from public.members where member_number = v_number and active;
  if not found then
    insert into public.access_attempts (ip, member_hash, success) values (v_ip, v_hash, false);
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if v_member.pin_hash is not null then
    if p_pin is null or length(p_pin) = 0 then
      return jsonb_build_object('ok', false, 'error', 'pin_required');
    end if;
    if extensions.crypt(p_pin, v_member.pin_hash) <> v_member.pin_hash then
      insert into public.access_attempts (ip, member_hash, success) values (v_ip, v_hash, false);
      return jsonb_build_object('ok', false, 'error', 'invalid_pin');
    end if;
  end if;

  if exists (select 1 from public.vote_participation where member_id = v_member.id and phase = v_phase_n) then
    insert into public.access_attempts (ip, member_hash, success) values (v_ip, v_hash, true);
    return jsonb_build_object('ok', false, 'error', 'already_voted', 'phase', v_phase);
  end if;

  insert into public.access_attempts (ip, member_hash, success) values (v_ip, v_hash, true);

  delete from public.voting_sessions where member_id = v_member.id;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.voting_sessions (token_hash, member_id, phase, expires_at)
  values (public.sha256_hex(v_token), v_member.id, v_phase_n, v_expires);

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'phase', v_phase,
    'expires_at', v_expires,
    'candidates', case when v_phase_n = 1 then coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name)
        from public.candidates c where c.active), '[]'::jsonb)
      else '[]'::jsonb end,
    'finalists', case when v_phase_n = 2 then coalesce((
        select jsonb_agg(jsonb_build_object('category_id', f.category_id, 'candidate_id', c.id, 'name', c.name) order by c.name)
        from public.finalists f join public.candidates c on c.id = f.candidate_id), '[]'::jsonb)
      else '[]'::jsonb end
  );
end
$$;

-- Passo 2: submissão de todos os votos de uma só vez (transação atómica).
-- p_votes: [{ "category_id": "...", "candidate_id": "..." }, ...]
create or replace function public.submit_ballot(p_token text, p_votes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.voting_sessions;
  v_s       public.event_settings;
  v_phase   text;
  v_phase_n smallint;
  v_active  integer;
  v_given   integer;
  v_valid   integer;
begin
  if p_token is null or p_votes is null or jsonb_typeof(p_votes) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid_ballot');
  end if;

  select * into v_session from public.voting_sessions
   where token_hash = public.sha256_hex(p_token) and expires_at > now()
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'session_expired');
  end if;

  select * into v_s from public.event_settings where id;
  v_phase := public.compute_phase(v_s);
  v_phase_n := case v_phase when 'phase1' then 1 when 'phase2' then 2 else null end;
  if v_phase_n is null or v_phase_n <> v_session.phase then
    delete from public.voting_sessions where token_hash = v_session.token_hash;
    return jsonb_build_object('ok', false, 'error', 'voting_closed', 'phase', v_phase);
  end if;

  -- Um voto (e apenas um) por cada categoria ativa.
  select count(*) into v_active from public.categories where active;
  select count(*), count(distinct (e ->> 'category_id')) into v_given, v_valid
    from jsonb_array_elements(p_votes) e;
  if v_given <> v_active or v_valid <> v_active then
    return jsonb_build_object('ok', false, 'error', 'invalid_ballot');
  end if;

  -- Validação de cada par categoria/candidato.
  if v_phase_n = 1 then
    select count(*) into v_valid
      from jsonb_array_elements(p_votes) e
      join public.categories k on k.id::text = e ->> 'category_id' and k.active
      join public.candidates c on c.id::text = e ->> 'candidate_id' and c.active;
  else
    select count(*) into v_valid
      from jsonb_array_elements(p_votes) e
      join public.categories k on k.id::text = e ->> 'category_id' and k.active
      join public.finalists f on f.category_id = k.id and f.candidate_id::text = e ->> 'candidate_id';
  end if;
  if v_valid <> v_active then
    return jsonb_build_object('ok', false, 'error', 'invalid_ballot');
  end if;

  -- Bloqueio do número nesta fase. A chave primária garante que, mesmo em
  -- pedidos simultâneos, apenas um é aceite.
  begin
    insert into public.vote_participation (member_id, phase) values (v_session.member_id, v_phase_n);
  exception when unique_violation then
    delete from public.voting_sessions where token_hash = v_session.token_hash;
    return jsonb_build_object('ok', false, 'error', 'already_voted');
  end;

  insert into public.vote_tallies (phase, category_id, candidate_id, votes)
  select v_phase_n, (e ->> 'category_id')::uuid, (e ->> 'candidate_id')::uuid, 1
    from jsonb_array_elements(p_votes) e
  on conflict (phase, category_id, candidate_id) do update set votes = public.vote_tallies.votes + 1;

  delete from public.voting_sessions where member_id = v_session.member_id;

  return jsonb_build_object('ok', true, 'phase', v_phase);
end
$$;

-- Resultados públicos: apenas depois de o administrador os publicar.
create or replace function public.get_public_results()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.event_settings;
begin
  select * into s from public.event_settings where id;
  if not s.results_published then
    return jsonb_build_object('published', false);
  end if;
  return jsonb_build_object(
    'published', true,
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'category_id', k.id, 'name', k.name, 'icon', k.icon, 'description', k.description,
        -- Os números de votos não são publicados: apenas a ordem e o vencedor.
        'finalists', (
          select coalesce(jsonb_agg(jsonb_build_object('candidate_id', r.candidate_id, 'name', r.name,
                                                       'winner', r.votes > 0 and r.votes = r.max_votes)
                        order by r.votes desc, r.name), '[]'::jsonb)
          from (
            select c.id as candidate_id, c.name, coalesce(t.votes, 0) as votes,
                   max(coalesce(t.votes, 0)) over () as max_votes
              from public.finalists f
              join public.candidates c on c.id = f.candidate_id
              left join public.vote_tallies t on t.phase = 2 and t.category_id = f.category_id and t.candidate_id = f.candidate_id
             where f.category_id = k.id
          ) r)
      ) order by k.sort_order, k.name)
      from public.categories k where k.active), '[]'::jsonb)
  );
end
$$;

-- -----------------------------------------------------------------------------
-- RPC de administração (todas verificam is_admin())
-- -----------------------------------------------------------------------------

create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso reservado a administradores' using errcode = '42501';
  end if;
end
$$;

-- ANONIMATO: enquanto uma fase está aberta, os totais dessa fase ficam escondidos
-- (os administradores veem apenas a participação). Como a lista de códigos mostra
-- quais já foram utilizados, ver os totais a mudar em tempo real permitiria
-- adivinhar em quem um código votou.
create or replace function public.results_visible(p_phase integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_phase
           when 1 then now() > s.phase1_closes_at
           when 2 then s.results_published or (s.phase2_closes_at is not null and now() > s.phase2_closes_at)
           else false
         end
    from public.event_settings s
   where s.id
$$;

-- Códigos de voto com indicação de "utilizado" em cada fase (nunca em quem votou).
create or replace function public.admin_list_members()
returns table (id uuid, member_number text, active boolean, created_at timestamptz, voted_phase1 boolean, voted_phase2 boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();
  return query
    select m.id, m.member_number, m.active, m.created_at,
           exists (select 1 from public.vote_participation p where p.member_id = m.id and p.phase = 1),
           exists (select 1 from public.vote_participation p where p.member_id = m.id and p.phase = 2)
      from public.members m
     order by length(m.member_number), m.member_number;
end
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.event_settings;
begin
  perform public.assert_admin();
  select * into s from public.event_settings where id;
  return jsonb_build_object(
    'server_now', now(),
    'phase', public.compute_phase(s),
    'settings', to_jsonb(s),
    'members_total',  (select count(*) from public.members),
    'members_active', (select count(*) from public.members where active),
    'phase1_voters',  (select count(*) from public.vote_participation where phase = 1),
    'phase2_voters',  (select count(*) from public.vote_participation where phase = 2),
    'candidates_active', (select count(*) from public.candidates where active),
    'categories_active', (select count(*) from public.categories where active),
    'finalists_count',   (select count(*) from public.finalists),
    'results_visible', jsonb_build_object('phase1', public.results_visible(1), 'phase2', public.results_visible(2)),
    -- empates só depois do fecho da 1ª fase (antes disso seria revelar resultados)
    'ties', case when public.results_visible(1)
                 then (select coalesce(jsonb_agg(distinct p.category_id), '[]'::jsonb) from public.finalist_proposal() p where p.status = 'tied')
                 else '[]'::jsonb end
  );
end
$$;

-- Resultados por fase. Fase 2: inclui todos os finalistas (mesmo com 0 votos).
create or replace function public.admin_results(p_phase integer)
returns table (category_id uuid, candidate_id uuid, candidate_name text, votes integer, is_finalist boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();
  -- com a fase aberta não devolve nada (ver results_visible)
  if not public.results_visible(p_phase) then
    return;
  end if;
  if p_phase = 1 then
    return query
      select t.category_id, t.candidate_id, c.name, t.votes,
             exists (select 1 from public.finalists f where f.category_id = t.category_id and f.candidate_id = t.candidate_id)
        from public.vote_tallies t join public.candidates c on c.id = t.candidate_id
       where t.phase = 1 and t.votes > 0
       order by t.category_id, t.votes desc, c.name;
  else
    return query
      select f.category_id, f.candidate_id, c.name, coalesce(t.votes, 0), true
        from public.finalists f
        join public.candidates c on c.id = f.candidate_id
        left join public.vote_tallies t on t.phase = 2 and t.category_id = f.category_id and t.candidate_id = f.candidate_id
       order by f.category_id, coalesce(t.votes, 0) desc, c.name;
  end if;
end
$$;

create or replace function public.admin_finalist_proposal()
returns table (category_id uuid, candidate_id uuid, candidate_name text, votes integer, rank_pos integer, status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();
  if not public.results_visible(1) then
    return;
  end if;
  return query select p.category_id, p.candidate_id, p.candidate_name, p.votes, p.rank_pos, p.status from public.finalist_proposal() p;
end
$$;

create or replace function public.admin_auto_finalize()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();
  return public.try_auto_finalize();
end
$$;

-- Definição manual dos finalistas (resolução de empates) e confirmação.
-- p_selection: { "<category_id>": ["<candidate_id>", ...], ... }
create or replace function public.admin_set_finalists(p_selection jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k record;
  v_missing integer;
begin
  perform public.assert_admin();
  if now() <= (select phase1_closes_at from public.event_settings where id) then
    return jsonb_build_object('ok', false, 'error', 'A 1ª fase ainda está aberta.');
  end if;
  if exists (select 1 from public.vote_participation where phase = 2) then
    return jsonb_build_object('ok', false, 'error', 'A 2ª fase já tem votos: não é possível alterar os finalistas.');
  end if;

  select count(*) into v_missing from public.categories c
   where c.active and jsonb_array_length(coalesce(p_selection -> c.id::text, '[]'::jsonb)) = 0;
  if v_missing > 0 then
    return jsonb_build_object('ok', false, 'error', 'Todas as categorias ativas precisam de pelo menos um finalista.');
  end if;

  delete from public.finalists where true; -- "where" obrigatório no Supabase (safeupdate)
  for k in select c.id from public.categories c where c.active loop
    insert into public.finalists (category_id, candidate_id, phase1_votes)
    select k.id, x.value::uuid, coalesce((select t.votes from public.vote_tallies t
                                     where t.phase = 1 and t.category_id = k.id and t.candidate_id = x.value::uuid), 0)
      from jsonb_array_elements_text(p_selection -> k.id::text) as x(value)
    on conflict do nothing;
  end loop;

  update public.event_settings
     set finalists_confirmed = true, finalists_confirmed_at = now(), updated_at = now()
   where id;
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.admin_reset_finalists()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();
  if exists (select 1 from public.vote_participation where phase = 2) then
    return jsonb_build_object('ok', false, 'error', 'A 2ª fase já tem votos: não é possível repor os finalistas.');
  end if;
  delete from public.finalists where true; -- "where" obrigatório no Supabase (safeupdate)
  update public.event_settings set finalists_confirmed = false, finalists_confirmed_at = null, updated_at = now() where id;
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.admin_import_members(p_numbers text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
  v_total integer;
begin
  perform public.assert_admin();
  with clean as (
    select distinct public.normalize_member_number(n) as num
      from unnest(coalesce(p_numbers, '{}')) n
     where length(public.normalize_member_number(n)) between 1 and 32
  ), ins as (
    insert into public.members (member_number) select num from clean
    on conflict (member_number) do nothing
    returning 1
  )
  select (select count(*) from ins), (select count(*) from clean) into v_inserted, v_total;
  return jsonb_build_object('inserted', v_inserted, 'skipped', v_total - v_inserted);
end
$$;

-- Define (ou remove, com NULL) o PIN opcional de um membro.
create or replace function public.admin_set_member_pin(p_member_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.assert_admin();
  update public.members
     set pin_hash = case when p_pin is null or length(p_pin) = 0 then null
                         else extensions.crypt(p_pin, extensions.gen_salt('bf')) end
   where id = p_member_id;
end
$$;

create or replace function public.admin_import_candidates(p_names text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
  v_total integer;
begin
  perform public.assert_admin();
  with clean as (
    select distinct on (public.normalize_name(n)) regexp_replace(trim(n), '\s+', ' ', 'g') as name
      from unnest(coalesce(p_names, '{}')) n
     where length(trim(n)) > 1
  ), ins as (
    insert into public.candidates (name) select name from clean
    on conflict do nothing
    returning 1
  )
  select (select count(*) from ins), (select count(*) from clean) into v_inserted, v_total;
  return jsonb_build_object('inserted', v_inserted, 'skipped', v_total - v_inserted);
end
$$;

-- Apaga os votos de uma fase (útil para testes antes da votação real).
create or replace function public.admin_reset_votes(p_phase integer, p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();
  if p_confirmation is distinct from 'APAGAR' then
    return jsonb_build_object('ok', false, 'error', 'Confirmação inválida.');
  end if;
  delete from public.vote_tallies where phase = p_phase;
  delete from public.vote_participation where phase = p_phase;
  delete from public.voting_sessions where phase = p_phase;
  return jsonb_build_object('ok', true);
end
$$;

-- -----------------------------------------------------------------------------
-- Permissões das funções
-- -----------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.normalize_name(text)                 to anon, authenticated;
grant execute on function public.normalize_member_number(text)        to anon, authenticated;
grant execute on function public.is_admin()                           to anon, authenticated;
grant execute on function public.compute_phase(public.event_settings) to authenticated;
grant execute on function public.get_public_state()                   to anon, authenticated;
grant execute on function public.start_voting_session(text, text)     to anon, authenticated;
grant execute on function public.submit_ballot(text, jsonb)           to anon, authenticated;
grant execute on function public.get_public_results()                 to anon, authenticated;

grant execute on function public.admin_overview()                     to authenticated;
grant execute on function public.admin_results(integer)               to authenticated;
grant execute on function public.admin_finalist_proposal()            to authenticated;
grant execute on function public.admin_auto_finalize()                to authenticated;
grant execute on function public.admin_set_finalists(jsonb)           to authenticated;
grant execute on function public.admin_reset_finalists()              to authenticated;
grant execute on function public.admin_import_members(text[])         to authenticated;
grant execute on function public.admin_set_member_pin(uuid, text)     to authenticated;
grant execute on function public.admin_import_candidates(text[])      to authenticated;
grant execute on function public.admin_reset_votes(integer, text)     to authenticated;
grant execute on function public.admin_list_members()                 to authenticated;

-- Funções internas: nunca expostas diretamente.
revoke execute on function public.finalist_proposal()  from public, anon, authenticated;
revoke execute on function public.try_auto_finalize()  from public, anon, authenticated;
revoke execute on function public.results_visible(integer) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Categorias iniciais
-- -----------------------------------------------------------------------------

insert into public.categories (slug, name, description, icon, sort_order) values
  ('revelacao', 'Prémio Revelação do Ano', 'Reconhecer e valorizar novos talentos que se destacaram pelo seu desempenho este ano.', 'sparkles', 1),
  ('inovacao', 'Prémio de Inovação e Criatividade', 'Reconhecer e valorizar a originalidade, a criatividade e a capacidade de inovar.', 'lightbulb', 2),
  ('carreira', 'Prémio de Carreira', 'Homenagear e valorizar um percurso de voluntariado, reconhecendo a dedicação e o legado ao longo dos anos.', 'award', 3),
  ('eficiencia', 'Prémio de Eficiência', 'Reconhecer e valorizar quem contribui para a melhoria contínua, transformando desafios em resultados concretos.', 'zap', 4),
  ('voluntariado', 'Prémio Espírito de Voluntariado', 'Reconhecer e valorizar a dedicação, o altruísmo e o espírito solidário de quem está sempre disponível para ajudar, cumprindo os Princípios Fundamentais da Cruz Vermelha.', 'heart', 5),
  ('dedicacao', 'Prémio de Dedicação', 'Homenagear e valorizar a dedicação, a lealdade e o contributo de quem veste a camisola.', 'medal', 6)
on conflict (slug) do nothing;
