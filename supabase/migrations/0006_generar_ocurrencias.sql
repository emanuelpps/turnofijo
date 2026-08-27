/**
 * Fechas de una serie, desde `p_desde` hasta `p_hasta` inclusive.
 *
 * La primera ocurrencia es el primer día >= p_desde que caiga en el día de la
 * semana pedido (0 = domingo, igual que extract(dow)). Después se avanza de a
 * un paso fijo: 7, 14 o 28 días.
 *
 * `p_sesiones_totales` NULL significa serie indefinida: corta solo por p_hasta.
 *
 * Es la ÚNICA definición de la cadencia en todo el sistema.
 */
create or replace function public.generar_ocurrencias(
  p_desde            date,
  p_dia_semana       smallint,
  p_frecuencia       public.serie_frecuencia,
  p_sesiones_totales integer,
  p_hasta            date
)
returns setof date
language sql
immutable
set search_path = public
as $$
  with parametros as (
    select
      p_desde + ((p_dia_semana - extract(dow from p_desde)::int + 7) % 7) as primera,
      case p_frecuencia
        when 'semanal'   then 7
        when 'quincenal' then 14
        when 'mensual'   then 28
      end as paso
  )
  select g::date
  from parametros,
       lateral generate_series(primera::timestamp, p_hasta::timestamp, (paso || ' days')::interval) as g
  where p_sesiones_totales is null
     or (g::date - primera) / paso < p_sesiones_totales;
$$;
