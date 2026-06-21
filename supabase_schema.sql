-- ============================================================
-- ContaNegocios v2 — Schema para Supabase
-- ============================================================

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text, full_name text,
  role text default 'contador' check (role in ('superadmin','admin','contador','readonly')),
  active boolean default true, created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), coalesce(new.raw_user_meta_data->>'role', 'contador'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null, description text, icon text default '🏢',
  created_by uuid references public.profiles(id), active boolean default true, created_at timestamptz default now()
);

create table if not exists public.project_members (
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'contador' check (role in ('admin','contador','readonly')),
  created_at timestamptz default now(), primary key (project_id, user_id)
);

create table if not exists public.transactions (
  id text primary key, project_id uuid references public.projects(id) on delete cascade,
  type text check (type in ('ingreso','gasto','costo')), fecha date, categoria text, descripcion text,
  "metodoPago" text, "ingresoTotal" numeric default 0, "gastoTotal" numeric default 0, "costoTotal" numeric default 0,
  impuesto numeric default 0, "valorImpuesto" numeric default 0, "totalNeto" numeric default 0,
  notas text, month integer, year integer, created_at timestamptz default now()
);

create table if not exists public.project_config (
  project_id uuid references public.projects(id) on delete cascade primary key,
  config jsonb default '{}', presupuesto jsonb default '{}', updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.transactions enable row level security;
alter table public.project_config enable row level security;

create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Superadmin can view all profiles" on public.profiles for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));
create policy "Superadmin can update profiles" on public.profiles for update using (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Superadmin sees all projects" on public.projects for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));
create policy "Members see their projects" on public.projects for select using (exists (select 1 from public.project_members where project_id = projects.id and user_id = auth.uid()));

create policy "Superadmin manages members" on public.project_members for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));
create policy "Users see own memberships" on public.project_members for select using (user_id = auth.uid());

create policy "Members can read transactions" on public.transactions for select using (
  exists (select 1 from public.project_members where project_id = transactions.project_id and user_id = auth.uid())
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));

create policy "Members can insert transactions" on public.transactions for insert with check (
  exists (select 1 from public.project_members where project_id = transactions.project_id and user_id = auth.uid() and role in ('admin','contador'))
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));

create policy "Members can update transactions" on public.transactions for update using (
  exists (select 1 from public.project_members where project_id = transactions.project_id and user_id = auth.uid() and role in ('admin','contador'))
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));

create policy "Members can delete transactions" on public.transactions for delete using (
  exists (select 1 from public.project_members where project_id = transactions.project_id and user_id = auth.uid() and role in ('admin','contador'))
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));

create policy "Members can read config" on public.project_config for select using (
  exists (select 1 from public.project_members where project_id = project_config.project_id and user_id = auth.uid())
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));

create policy "Admins can write config" on public.project_config for all using (
  exists (select 1 from public.project_members where project_id = project_config.project_id and user_id = auth.uid() and role in ('admin','contador'))
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'));

-- ============================================================
-- Ejecutar DESPUÉS de crear tu cuenta, reemplazando el email:
-- update public.profiles set role = 'superadmin' where email = 'TU_EMAIL@aqui.com';
-- ============================================================
