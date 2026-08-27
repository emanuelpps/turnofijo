/**
 * Extiende una serie hasta `p_hasta`, salteando lo que choca. Devuelve cuántos
 * turnos creó.
 *
 * security definer porque la llama pg_cron, que corre sin sesión y por lo tanto
 * sin auth.uid(). El EXECUTE se revoca de PUBLIC justo abajo: nadie la puede
 * llamar desde la API con el id de la serie de otro.
 */
create or replace function public.materializar_serie(p_serie_id uuid, p_hasta date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s         public.series;
  v_ultima  date;
  v_fecha   date;
  v_inicio  timestamptz;
  v_fin     timestamptz;
  v_creadas integer := 0;
begin
  select * into s from public.series where id = p_serie_id;
  if not found or s.estado <> 'activa' then
    return 0;
  end if;

  -- Nunca se rellena hacia atrás: un hueco anterior al último turno suele ser
  -- una cancelación o una mudanza hecha a mano.
  select coalesce(
           max((lower(a.periodo) at time zone 'America/Argentina/Buenos_Aires')::date),
           s.desde - 1
         )
    into v_ultima
    from public.appointments a
   where a.series_id = s.id;

  for v_fecha in
    select * from public.generar_ocurrencias(
      s.desde, s.dia_semana, s.frecuencia, s.sesiones_totales, p_hasta
    )
  loop
    continue when v_fecha <= v_ultima;

    v_inicio := (v_fecha::text || ' ' || s.hora_local::text)::timestamp
                  at time zone 'America/Argentina/Buenos_Aires';
    v_fin := v_inicio + (s.duracion_min || ' minutes')::interval;

    continue when exists (
      select 1 from public.appointments a
       where a.professional_id = s.professional_id
         and a.estado <> 'cancelado'
         and a.periodo && tstzrange(v_inicio, v_fin, '[)')
    );

    continue when exists (
      select 1 from public.blocks b
       where b.professional_id = s.professional_id
         and b.periodo && tstzrange(v_inicio, v_fin, '[)')
    );

    insert into public.appointments (professional_id, patient_id, series_id, periodo)
    values (s.professional_id, s.patient_id, s.id, tstzrange(v_inicio, v_fin, '[)'));

    v_creadas := v_creadas + 1;
  end loop;

  update public.series
     set horizonte_hasta = greatest(horizonte_hasta, p_hasta)
   where id = p_serie_id;

  return v_creadas;
end;
$$;

revoke execute on function public.materializar_serie(uuid, date) from public, anon, authenticated;
grant execute on function public.materializar_serie(uuid, date) to service_role;

/** Empuja todas las series activas al horizonte de 8 semanas. La corre pg_cron. */
create or replace function public.extender_series()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r       record;
  v_total integer := 0;
  v_hasta date := (now() at time zone 'America/Argentina/Buenos_Aires')::date + 56;
begin
  for r in select id from public.series where estado = 'activa' loop
    v_total := v_total + public.materializar_serie(r.id, v_hasta);
  end loop;
  return v_total;
end;
$$;

revoke execute on function public.extender_series() from public, anon, authenticated;
grant execute on function public.extender_series() to service_role;

create extension if not exists pg_cron;

-- 06:00 UTC = 03:00 en Argentina.
select cron.schedule('extender-series', '0 6 * * *', $$select public.extender_series();$$);
