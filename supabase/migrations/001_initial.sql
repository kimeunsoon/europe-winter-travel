-- Run once in the connected Supabase project's SQL editor.
create table if not exists public.posts (
 id uuid primary key default gen_random_uuid(), title text not null check (char_length(title) between 1 and 100),
 content text not null check (char_length(content) between 1 and 3000), author text not null check (char_length(author) between 1 and 20),
 created_at timestamptz not null default now(), likes integer not null default 0 check (likes >= 0), user_id uuid references auth.users(id) on delete set null
);
create table if not exists public.rankings (
 id uuid primary key default gen_random_uuid(), nickname text not null check (char_length(nickname) between 1 and 20),
 score integer not null check (score in (0,100,200,300)), played_at timestamptz not null default now(), user_id uuid references auth.users(id) on delete set null
);
create table if not exists public.memberships (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
 nickname text not null check (char_length(nickname) between 2 and 20), season text not null check (season in ('겨울과 여름 모두','1·2월 겨울 여행','8월 여름 여행')), created_at timestamptz not null default now()
);
create table if not exists public.post_likes (
 post_id uuid references public.posts(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, primary key(post_id,user_id)
);
alter table public.posts enable row level security;
alter table public.rankings enable row level security;
alter table public.memberships enable row level security;
alter table public.post_likes enable row level security;
create policy "Public can read posts" on public.posts for select using (true);
create policy "Members create own posts" on public.posts for insert to authenticated with check (auth.uid() = user_id and likes = 0 and exists (select 1 from public.memberships m where m.user_id=auth.uid() and m.nickname=author));
create policy "Public can read rankings" on public.rankings for select using (true);
create policy "Members submit scores" on public.rankings for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.memberships m where m.user_id=auth.uid() and m.nickname=rankings.nickname));
create policy "Read own membership" on public.memberships for select to authenticated using (auth.uid() = user_id);
create policy "Create own membership" on public.memberships for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own membership" on public.memberships for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Read own likes" on public.post_likes for select to authenticated using (auth.uid() = user_id);
create or replace function public.like_post(post_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.memberships where user_id=auth.uid()) then raise exception 'Membership required'; end if;
 insert into public.post_likes(post_id,user_id) values(post_id,auth.uid()) on conflict do nothing;
 if found then update public.posts set likes=likes+1 where id=post_id; end if;
end; $$;
revoke all on function public.like_post(uuid) from public;
grant execute on function public.like_post(uuid) to authenticated;
grant select on public.posts, public.rankings to anon, authenticated;
grant insert on public.posts, public.rankings to authenticated;
grant select, insert, update on public.memberships to authenticated;
grant select on public.post_likes to authenticated;
create index if not exists posts_created_idx on public.posts(created_at desc);
create index if not exists rankings_score_idx on public.rankings(score desc, played_at);

