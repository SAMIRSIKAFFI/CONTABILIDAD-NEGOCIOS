-- ============================================================
-- Migración: Plantillas de Gastos/Ingresos/Costos Recurrentes
-- Ejecutar en Supabase SQL Editor
-- ============================================================

create table if not exists public.recurring_templates (
  id text primary key,
  project_id uuid references public.projects(id) on delete cascade,
  type text check (type in ('ingreso','gasto','costo')),
  categoria text,
  descripcion text,
  "metodoPago" text,
  impuesto numeric default 0,
  "expectedDay" integer default 1,  -- día esperado del mes (1-31)
  "defaultAmount" numeric default 0, -- monto sugerido (opcional, puede ser 0)
  notas text,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.recurring_templates enable row level security;

create policy "Members can read templates" on public.recurring_templates
  for select using (
    exists (select 1 from public.project_members where project_id = recurring_templates.project_id and user_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );

create policy "Members can insert templates" on public.recurring_templates
  for insert with check (
    exists (
      select 1 from public.project_members
      where project_id = recurring_templates.project_id and user_id = auth.uid()
      and role in ('admin','contador')
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );

create policy "Members can update templates" on public.recurring_templates
  for update using (
    exists (
      select 1 from public.project_members
      where project_id = recurring_templates.project_id and user_id = auth.uid()
      and role in ('admin','contador')
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );

create policy "Members can delete templates" on public.recurring_templates
  for delete using (
    exists (
      select 1 from public.project_members
      where project_id = recurring_templates.project_id and user_id = auth.uid()
      and role in ('admin','contador')
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );
