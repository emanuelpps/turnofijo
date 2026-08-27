/**
 * Crea la serie y materializa los turnos que le pasan en `p_inicios`.
 *
 * La app calcula y valida los inicios antes de llamar (vista previa): acá no se
 * decide nada, se escribe. Todo o nada: si un turno viola la exclusión de
 * superposiciones, la serie tampoco queda creada.
 */
create or replace function public.crear_serie(
  p_patient_id       uuid,
  p_dia_semana       smallint,
  p_hora_local       time,
  p_duracion_min     integer,
  p_frecuencia       public.serie_frecuencia,
  p_sesiones_totales integer,
  p_desde            date,
  p_horizonte_hasta  date,
  p_inicios          timestamptz[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_serie_id uuid;
  v_inicio   timestamptz;
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;

  if array_length(p_inicios, 1) is null then
    raise exception 'la serie no tiene ningún turno para crear';
  end if;

  insert into public.series (
    professional_id, patient_id, dia_semana, hora_local, duracion_min,
    frecuencia, sesiones_totales, desde, horizonte_hasta
  )
  values (
    auth.uid(), p_patient_id, p_dia_semana, p_hora_local, p_duracion_min,
    p_frecuencia, p_sesiones_totales, p_desde, p_horizonte_hasta
  )
  returning id into v_serie_id;

  foreach v_inicio in array p_inicios loop
    insert into public.appointments (professional_id, patient_id, series_id, periodo)
    values (
      auth.uid(),
      p_patient_id,
      v_serie_id,
      tstzrange(v_inicio, v_inicio + (p_duracion_min || ' minutes')::interval, '[)')
    );
  end loop;

  return v_serie_id;
end;
$$;
