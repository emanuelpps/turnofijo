create type public.serie_frecuencia as enum ('semanal', 'quincenal', 'mensual');
create type public.serie_estado as enum ('activa', 'finalizada', 'cancelada');

create table public.series (
  id                uuid primary key default gen_random_uuid(),
  professional_id   uuid not null references public.professionals(id) on delete cascade,
  patient_id        uuid not null,
  dia_semana        smallint not null check (dia_semana between 0 and 6),
  hora_local        time not null,
  duracion_min      integer not null check (duracion_min between 5 and 480),
  frecuencia        public.serie_frecuencia not null default 'semanal',
  -- NULL = indefinida: el psicólogo que atiende a alguien hace tres años.
  sesiones_totales  integer check (sesiones_totales is null or sesiones_totales between 1 and 200),
  desde             date not null,
  -- Hasta dónde se materializó. El job del horizonte rodante lo empuja.
  horizonte_hasta   date not null,
  estado            public.serie_estado not null default 'activa',
  creado_en         timestamptz not null default now(),

  constraint series_paciente_del_profesional
    foreign key (patient_id, professional_id)
    references public.patients (id, professional_id)
    on delete restrict,

  -- Habilita la FK compuesta desde appointments.
  unique (id, professional_id)
);

comment on table public.series is
  'Serie recurrente. Los turnos se materializan en appointments: acá vive la regla, no el calendario.';

create index series_activas on public.series (professional_id, estado);

alter table public.series enable row level security;

create policy series_todo_propio on public.series
  for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- La FK quedó pendiente desde la migración 0004. MATCH SIMPLE: los turnos
-- sueltos (series_id NULL) pasan sin problema.
-- on delete restrict: una serie con turnos no se borra, se finaliza o se cancela.
alter table public.appointments
  add constraint appointments_serie_del_profesional
  foreign key (series_id, professional_id)
  references public.series (id, professional_id)
  on delete restrict;

create index appointments_por_serie on public.appointments (series_id);
