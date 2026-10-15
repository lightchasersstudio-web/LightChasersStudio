-- mark_booking_paid: also flag payments that land on a booking that is no
-- longer waiting for one (cancelled, declined, completed, or already paid), so
-- staff see it and can refund. Outcomes: paid | paid_late | needs_review |
-- duplicate | unknown_booking.
create or replace function public.mark_booking_paid(
  p_reference text,
  p_checkout_id text,
  p_payment_id text,
  p_amount_cents integer,
  p_raw jsonb
)
returns table (booking_id uuid, outcome text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_booking public.bookings%rowtype;
  v_outcome text;
begin
  if exists (select 1 from public.payments where provider_payment_id = p_payment_id) then
    return query select b.id, 'duplicate'::text from public.bookings b where b.reference_code = p_reference;
    return;
  end if;

  select * into v_booking from public.bookings where reference_code = p_reference for update;
  if not found then
    return query select null::uuid, 'unknown_booking'::text;
    return;
  end if;

  insert into public.payments as p (
    booking_id, provider, provider_checkout_id, provider_payment_id, amount_cents, status, paid_at, raw
  ) values (
    v_booking.id, 'paymongo', p_checkout_id, p_payment_id, p_amount_cents, 'paid', now(), p_raw
  )
  on conflict (provider_checkout_id) do update
    set provider_payment_id = excluded.provider_payment_id,
        amount_cents = excluded.amount_cents,
        status = 'paid',
        paid_at = excluded.paid_at,
        raw = excluded.raw;

  if v_booking.status = 'pending_payment' then
    update public.bookings set status = 'pending' where id = v_booking.id;
    v_outcome := 'paid';
  elsif v_booking.status = 'expired' then
    begin
      perform public.assert_capacity(v_booking.start_at, v_booking.blocked_until, v_booking.id);
      v_outcome := 'paid_late';
    exception
      when raise_exception then
        if sqlerrm <> 'slot_unavailable' then
          raise;
        end if;
        v_outcome := 'needs_review';
    end;
    update public.bookings
    set status = 'pending', needs_refund_review = (v_outcome = 'needs_review')
    where id = v_booking.id;
  else
    -- Paid for a booking that was cancelled/declined/completed, or paid twice
    -- (two checkouts): keep the money on record and flag it for a refund.
    update public.bookings set needs_refund_review = true where id = v_booking.id;
    v_outcome := 'needs_review';
  end if;

  return query select v_booking.id, v_outcome;
end;
$$;
