-- Replace the whole weekly schedule in one transaction, so readers (the public
-- slot picker, create_booking) never see a half-saved week.
-- SECURITY INVOKER: RLS on availability_rules still applies; the explicit check
-- just gives a clear error instead of a silent no-op.
create function public.replace_availability_rules(p_rules jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) > 70 then
    raise exception 'invalid_rules' using errcode = '22023';
  end if;

  -- `where true`: Supabase's safeupdate rejects DELETE without a WHERE clause.
  delete from public.availability_rules where true;

  insert into public.availability_rules (day_of_week, start_time, end_time)
  select (r ->> 'day_of_week')::smallint, (r ->> 'start_time')::time, (r ->> 'end_time')::time
  from jsonb_array_elements(p_rules) as r;
end;
$$;

revoke execute on function public.replace_availability_rules(jsonb) from public;
grant execute on function public.replace_availability_rules(jsonb) to authenticated;
