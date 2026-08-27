/**
 * Corta la serie en el turno indicado y la vuelve a armar con día y hora nuevos.
 *
 * Los turnos con historia (asistio, ausente, cancelado) no se tocan nunca: son
 * el registro de lo que efectivamente pasó.
 *
 * security definer porque necesita llamar a materializar_serie, cuyo EXECUTE
 * está revocado. La pertenencia se verifica a mano contra auth.uid().
 */
create or replace function public.reprogramar_serie_desde(
  p_appointment_id   uuid,
  p_nuevo_dia_semana smallint,
  p_nueva_hora       time,
  p_desde            date
)
returns table (serie_nueva_id uuid, creadas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  a           public.appointments;
  s           public.series;
  v_restantes integer;
  v_nueva     uuid;
  v_creadas   integer;
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;

  select * into a from public.appointments where id = p_appointment_id;
  if not found or a.professional_id <> auth.uid() then
    raise exception 'ese turno no es tuyo';
  end if;
  if a.series_id is null then
    raise exception 'ese turno no pertenece a una serie';
  end if;

  select * into s from public.series where id = a.series_id;

  delete from public.appointments
   where series_id = s.id
     and estado in ('programado', 'confirmado')
     and lower(periodo) >= lower(a.periodo);

  if s.sesiones_totales is not null then
    select greatest(s.sesiones_totales - count(*), 1)
      into v_restantes
      from public.appointments
     where series_id = s.id;
  else
    v_restantes := null;
  end if;

  update public.series
     set estado = 'finalizada',
         horizonte_hasta = p_desde - 1
   where id = s.id;

  insert into public.series (
    professional_id, patient_id, dia_semana, hora_local, duracion_min,
    frecuencia, sesiones_totales, desde, horizonte_hasta
  )
  values (
    s.professional_id, s.patient_id, p_nuevo_dia_semana, p_nueva_hora, s.duracion_min,
    s.frecuencia, v_restantes, p_desde, p_desde - 1
  )
  returning id into v_nueva;

  v_creadas := public.materializar_serie(v_nueva, p_desde + 56);

  return query select v_nueva, v_creadas;
end;
$$;

/**
 * Cancela los turnos futuros de una serie y la da de baja. Los pasados quedan
 * como están: son historial de asistencia.
 */
create or replace function public.cancelar_serie(p_serie_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cancelados integer;
begin
  update public.appointments
     set estado = 'cancelado', cancelado_por = 'profesional'
   where series_id = p_serie_id
     and estado in ('programado', 'confirmado')
     and lower(periodo) >= now();

  get diagnostics v_cancelados = row_count;

  update public.series set estado = 'cancelada' where id = p_serie_id;

  return v_cancelados;
end;
$$;
