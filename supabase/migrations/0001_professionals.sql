-- btree_gist hace falta para la restricción EXCLUDE de appointments (migración 0004):
-- permite mezclar el operador = sobre uuid con && sobre tstzrange en el mismo índice.
create extension if not exists btree_gist;

create table public.professionals (
  id                    uuid primary key references auth.users(id) on delete cascade,
  nombre                text not null default '',
  especialidad          text not null default 'psicologia'
                          check (especialidad in ('psicologia', 'nutricion', 'otra')),
  email                 text not null,
  telefono_contacto     text,
  duracion_default_min  integer not null default 50
                          check (duracion_default_min between 5 and 480),
  timezone              text not null default 'America/Argentina/Buenos_Aires',
  creado_en             timestamptz not null default now()
);

comment on table public.professionals is
  'Un profesional = un tenant. El id es auth.uid(): no hay organizaciones en v1.';

alter table public.professionals enable row level security;

create policy professionals_select_propio on public.professionals
  for select using (id = auth.uid());

create policy professionals_update_propio on public.professionals
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Sin política de INSERT ni DELETE a propósito: la fila la crea el trigger de
-- abajo y se borra en cascada cuando se borra el usuario de auth.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.professionals (id, email, nombre)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Solo la llama el trigger de arriba: nadie debería poder invocarla vía RPC.
revoke execute on function public.handle_new_user() from anon, authenticated;
