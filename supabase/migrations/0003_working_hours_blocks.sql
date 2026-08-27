create table public.working_hours (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals(id) on delete cascade,
  dia_semana       smallint not null check (dia_semana between 0 and 6),
  desde            time not null,
  hasta            time not null,
  constraint working_hours_rango_valido check (hasta > desde)
);

comment on table public.working_hours is
  'Franjas de atención por día. Puede haber más de una por día (mañana y tarde).';

create index working_hours_por_profesional
  on public.working_hours (professional_id, dia_semana);

alter table public.working_hours enable row level security;

create policy working_hours_todo_propio on public.working_hours
  for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create table public.blocks (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals(id) on delete cascade,
  periodo          tstzrange not null,
  motivo           text not null default '',
  creado_en        timestamptz not null default now(),
  constraint blocks_periodo_no_vacio check (not isempty(periodo))
);

comment on table public.blocks is
  'Vacaciones, feriados y ausencias puntuales. Se pueden solapar entre sí sin problema.';

create index blocks_por_periodo
  on public.blocks using gist (professional_id, periodo);

alter table public.blocks enable row level security;

create policy blocks_todo_propio on public.blocks
  for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- Reemplaza la grilla semanal completa en una sola transacción.
-- security invoker: RLS sigue aplicando, así que nadie puede tocar la de otro.
create or replace function public.reemplazar_horarios(franjas jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;

  delete from public.working_hours where professional_id = auth.uid();

  insert into public.working_hours (professional_id, dia_semana, desde, hasta)
  select
    auth.uid(),
    (f ->> 'dia_semana')::smallint,
    (f ->> 'desde')::time,
    (f ->> 'hasta')::time
  from jsonb_array_elements(franjas) as f;
end;
$$;
