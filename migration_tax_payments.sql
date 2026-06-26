-- ============================================================
-- Migración: Previsión y Pago Real de Impuestos (IVA, IT, RC-IVA)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

create table if not exists public.tax_payments (
  id text primary key,
  project_id uuid references public.projects(id) on delete cascade,
  tax_type text check (tax_type in ('iva','it','rciva')),
  period_key text,        -- '2026-06' para mensual (iva/it), '2026-Q2' para trimestral (rciva)
  real_paid numeric default 0,
  paid_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(project_id, tax_type, period_key)
);

alter table public.tax_payments enable row level security;

create policy "Members can read tax payments" on public.tax_payments
  for select using (
    exists (select 1 from public.project_members where project_id = tax_payments.project_id and user_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );

create policy "Members can upsert tax payments" on public.tax_payments
  for insert with check (
    exists (
      select 1 from public.project_members
      where project_id = tax_payments.project_id and user_id = auth.uid()
      and role in ('admin','contador')
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );

create policy "Members can update tax payments" on public.tax_payments
  for update using (
    exists (
      select 1 from public.project_members
      where project_id = tax_payments.project_id and user_id = auth.uid()
      and role in ('admin','contador')
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );

create policy "Members can delete tax payments" on public.tax_payments
  for delete using (
    exists (
      select 1 from public.project_members
      where project_id = tax_payments.project_id and user_id = auth.uid()
      and role in ('admin','contador')
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );
