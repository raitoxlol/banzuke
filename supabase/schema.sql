-- Pulse League schema. Paste into Supabase SQL editor and run once.

create table if not exists teams (
  id bigint generated always as identity primary key,
  name text not null unique,
  color text not null
);

insert into teams (name, color) values
  ('Team Kichijoji', '#E07A8A'),
  ('Team Shibuya',  '#6FA8DC'),
  ('Team Akiba',    '#D4B05C'),
  ('Team Shimokita','#6FBF8E')
on conflict (name) do nothing;

create table if not exists players (
  github_login text primary key,
  auth_user_id uuid unique,          -- Supabase auth user (GitHub OAuth)
  display_name text,
  avatar_url text,
  team_id bigint not null references teams(id),
  lat double precision,
  lng double precision,
  joined_at timestamptz not null default now()
);

create table if not exists events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('push','pr_merged','release')),
  points int not null check (points >= 0),
  player_login text not null references players(github_login) on delete cascade,
  team_id bigint not null references teams(id),
  repo text not null,
  summary text not null default '',
  lat double precision not null,
  lng double precision not null,
  dedupe_key text unique              -- delivery id / commit sha, stops replays
);
create index if not exists events_created_idx on events (created_at desc);
create index if not exists events_player_hour_idx on events (player_login, kind, created_at);

create table if not exists commentary (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  line text not null
);

-- Live team scores for the current week (JST weeks start Monday).
create or replace view team_scores as
select t.id, t.name, t.color, coalesce(sum(e.points), 0)::int as score
from teams t
left join events e
  on e.team_id = t.id
 and e.created_at >= date_trunc('week', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo'
group by t.id;

-- Auto-draft: put a new player on the team with the fewest players.
create or replace function draft_player(
  p_login text, p_auth uuid, p_name text, p_avatar text
) returns players language plpgsql security definer as $$
declare
  t bigint;
  r players;
begin
  select * into r from players where github_login = p_login;
  if found then
    update players set auth_user_id = coalesce(auth_user_id, p_auth) where github_login = p_login returning * into r;
    return r;
  end if;
  select teams.id into t from teams
    left join players on players.team_id = teams.id
    group by teams.id order by count(players.github_login), teams.id limit 1;
  insert into players (github_login, auth_user_id, display_name, avatar_url, team_id, lat, lng)
  values (p_login, p_auth, p_name, p_avatar, t,
          -- placeholder spot until the player sets a city: hashed into the Tokyo area
          35.60 + (abs(hashtext(p_login)) % 200) / 1000.0,
          139.50 + (abs(hashtext(p_login || 'x')) % 300) / 1000.0)
  returning * into r;
  return r;
end $$;

-- Public read-only access for the broadcast; writes only via service role.
alter table teams enable row level security;
alter table players enable row level security;
alter table events enable row level security;
alter table commentary enable row level security;
create policy "public read teams" on teams for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read events" on events for select using (true);
create policy "public read commentary" on commentary for select using (true);

-- Realtime: broadcast new events and commentary to the live page.
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table commentary;
