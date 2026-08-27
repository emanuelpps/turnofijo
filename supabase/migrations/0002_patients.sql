create table public.patients (
  id                     uuid primary key default gen_random_uuid(),
  professional_id        uuid not null references public.professionals(id) on delete cascade,
  nombre                 text not null check (length(trim(nombre)) > 0),
  telefono_e164          text not null check (telefono_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email                  text,
  notas_administrativas  text,
  contactable            boolean not null default true,
  consentimiento_wa_en   timestamptz,
  archivado_en           timestamptz,
  creado_en              timestamptz not null default now(),

  -- Permite la clave foránea compuesta de appointments: garantiza en la base
  -- que un turno nunca apunte al paciente de otro profesional.
  unique (id, professional_id)
);

comment on table public.patients is
  'Datos de contacto. SIN campos clínicos: es una restricción explícita del diseño.';

create unique index patients_telefono_unico_por_profesional
  on public.patients (professional_id, telefono_e164);

create index patients_por_nombre on public.patients (professional_id, nombre);

alter table public.patients enable row level security;

create policy patients_todo_propio on public.patients
  for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());
