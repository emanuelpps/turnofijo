create type public.appointment_estado as enum (
  'programado', 'confirmado', 'cancelado', 'asistio', 'ausente'
);

create type public.cancelado_por_tipo as enum ('profesional', 'paciente', 'sistema');

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals(id) on delete cascade,
  patient_id       uuid not null,
  -- La FK a series se agrega en la Etapa 1b, cuando exista la tabla.
  series_id        uuid,
  periodo          tstzrange not null,
  estado           public.appointment_estado not null default 'programado',
  cancelado_por    public.cancelado_por_tipo,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),

  constraint appointments_periodo_no_vacio check (not isempty(periodo)),

  -- El paciente tiene que ser del mismo profesional. Lo garantiza la base.
  constraint appointments_paciente_del_profesional
    foreign key (patient_id, professional_id)
    references public.patients (id, professional_id)
    on delete restrict,

  -- Nunca dos turnos superpuestos del mismo profesional. Los cancelados no cuentan.
  constraint appointments_sin_superposicion
    exclude using gist (professional_id with =, periodo with &&)
    where (estado <> 'cancelado')
);

comment on constraint appointments_sin_superposicion on public.appointments is
  'Garantía de esquema: ni un doble click ni dos pestañas abiertas pueden pisar dos turnos.';

create index appointments_por_inicio
  on public.appointments (professional_id, (lower(periodo)));

create index appointments_por_paciente
  on public.appointments (patient_id);

alter table public.appointments enable row level security;

create policy appointments_todo_propio on public.appointments
  for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger appointments_actualizado_en
  before update on public.appointments
  for each row execute function public.tocar_actualizado_en();
