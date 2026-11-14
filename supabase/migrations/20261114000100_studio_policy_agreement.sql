-- Studio Policy Manual & Client Agreement (owner request 2026-11-14).
--  1. The manual's wording lives in business_settings.studio_policy (Admin →
--     Settings → Studio policy). Clients booking a studio package must tick
--     "I agree" on Review & pay; the wording they agreed to is kept with the
--     booking (policy 8.3: the version in effect when booked applies).
--  2. What the studio must know at booking time: a nude or sensitive shoot
--     (3.8), pets or messy materials (3.9, ₱2,000 refundable security deposit),
--     and opting out of behind-the-scenes posts (7.4).
--  3. Balance payments by Maya or bank transfer (1.3), next to GCash and cash.
--  4. The ₱500 rescheduling fee (1.4) on studio packages that had none.

-- ---------------------------------------------------------------------------
-- 1. The policy wording + the copy each booking agreed to
-- ---------------------------------------------------------------------------
alter table public.business_settings
  add column studio_policy text not null default ''
    check (char_length(studio_policy) <= 60000);

comment on column public.business_settings.studio_policy is
  'Studio Policy Manual & Client Agreement shown on Review & pay for studio packages. Empty = none.';

alter table public.bookings
  add column policy_text text,
  add column policy_accepted_at timestamptz,
  add column sensitive_shoot boolean not null default false,
  add column pets_or_messy boolean not null default false,
  add column bts_opt_out boolean not null default false;

comment on column public.bookings.policy_text is
  'The studio policy wording the client agreed to when booking online (null = not asked).';
comment on column public.bookings.sensitive_shoot is
  'Client said it is a nude or sensitive shoot (policy 3.8): block out the date, no BTS content.';
comment on column public.bookings.pets_or_messy is
  'Client is bringing pets or messy materials (policy 3.9): collect the ₱2,000 refundable security deposit.';
comment on column public.bookings.bts_opt_out is
  'Client does not want to appear in behind-the-scenes posts (policy 7.4).';

update public.business_settings set studio_policy = $policy$Studio Policy Manual & Client Agreement
Light Chasers Studio | Rental Photography Studio
Unit 9, 3rd Floor, MPO Building, Don Alfaro St., Tetuan, Zamboanga City, Philippines | +63 998 575 5118

1. BOOKING, PAYMENT & DOWN PAYMENT

1.1 Booking Confirmation. A booking is confirmed once the renter receives a confirmation email with a reference number issued through the studio's website.

1.2 Down Payment. A non-refundable 50% down payment is required upon confirmation to hold the reserved time block.

1.3 Full Payment. The remaining 50% balance must be settled in full before or upon arrival at the studio, via GCash, Maya, online bank transfer (InstaPay/PESONet), or cash.

1.4 Rescheduling. A booking may be rescheduled once (1), up to 48 hours before the reservation start time and subject to studio availability. A rescheduling fee of ₱500 is charged, except when the reschedule is due to force majeure (see 1.8). The down payment remains valid until the booked date has passed.

1.5 Receipts. A receipt is generated and issued to the renter upon each payment.

1.6 Cancellations.
• No refunds are given for cancelled bookings. A renter who cancels 48 hours or more before the reservation start time may reschedule instead, subject to the ₱500 rescheduling fee.
• Cancellations made less than 48 hours before the reservation start time cannot be rescheduled, and the down payment is kept and not refunded. The renter may make a new booking.

1.7 No-Shows. A renter who does not show up for the booked date cannot reschedule, and the down payment is kept and not refunded. The renter may make a new booking.

1.8 Force Majeure. If the studio cannot host a booking because of force majeure (such as a typhoon, flood, earthquake, power outage, or government order), the renter may choose to reschedule without a rescheduling fee or to cancel. If the renter cancels, all payments made, including the down payment, are refunded in full.

1.9 Late Arrivals. No late fee is charged. The session still ends at its scheduled time, and any unused time may be rescheduled, subject to the ₱500 rescheduling fee.

2. STUDIO ACCESS & TIME MANAGEMENT

2.1 Rental Block Duration. The rental period includes setup, ingress, shoot time, breakdown, egress, and cleanup.

2.2 Session Time. No overtime is offered or charged. A renter may use the time remaining in the booked block or reschedule the unused time, subject to the ₱500 rescheduling fee (see 1.9). Renters who stay past the end of their session will be asked to leave the premises.

2.3 Check-In and Check-Out Inspection. A representative of the renter must inspect the space and sign off on equipment condition with studio personnel upon arrival and before departure.

2.4 Rental Inclusions. The rental includes the use of a backdrop, studio lights, fixtures, and furniture.

2.5 Renter ID & Presence. The renter must present a valid ID upon arrival. The renter must remain on the premises for the whole rental period unless the studio permits otherwise and the necessary waivers have been signed.

2.6 Subletting & Transfer. A booking may not be sublet or transferred to another person without the studio's prior written approval.

2.7 Renter Age. The renter must be at least 18 years old. If the person booking is under 18, a parent or legal representative must be present at the time of the shoot and sign this agreement as the renter.

2.8 Operating Hours. The studio is open from 9:00 AM to 5:00 PM daily.

3. STUDIO RULES & EQUIPMENT USE

3.1 Equipment Handling. All studio lighting, C-stands, softboxes, and accessories must be handled with care. Renters unfamiliar with standard studio equipment must ask staff for assistance.

3.2 Seamless Paper Backdrops. Renters may step on the seamless paper and pull it beyond the pre-set length onto the floor. Soiled, torn, or damaged paper that has to be cut off will be billed at ₱600 per yard.

3.3 Footwear on Backdrops. Outdoor footwear is prohibited on white seamless paper and studio backdrops unless shoe covers are worn or the soles are thoroughly cleaned and taped.

3.4 Prohibited Items & Activities.
• No open flames, smoke machines, candles, or pyrotechnics without explicit permission and compliance with local fire safety standards (Fire Code of the Philippines, RA 9514).
• No glitter, body oil, flour, color powder, or liquid messes without prior written consent and the security deposit in 3.9.
• No smoking, vaping (e-cigarettes), alcohol, or illegal substances anywhere on the premises.
• No illegal activities or dangerous props.

3.5 Food & Drinks. Food is permitted on the premises. Drinks are prohibited in the shooting area.

3.6 Set Design & Anchors. The studio provides physical anchor points for set pieces that need to be mounted or secured. Renters must use these anchor points and ask staff if additional support is needed.

3.7 Electrical Use. Renters may charge personal devices using the studio's outlets. High-voltage or high-wattage equipment may not be brought into or used in the studio.

3.8 Nude & Sensitive Shoots. Nude and sensitive shoots are allowed only when the date is blocked out for the booking, and the studio must be informed at the time of booking. All persons photographed in these shoots must be 18 years old or above. CCTV cameras continue to operate in the main studio areas during these shoots (see 7.3); by booking, the renter agrees to this and is responsible for informing all participants and obtaining their consent. CCTV footage of these shoots is released only to the client, upon presentation of a police report or a sworn affidavit with supporting proof.

3.9 Security Deposit for Messy Materials & Pets. A refundable security deposit of ₱2,000 is required for any shoot that uses the materials listed in 3.4 or brings pets. Pets are allowed only with this deposit. The deposit stays at ₱2,000 even when a shoot involves both messy materials and pets. The deposit is refunded in full if no damage, dirt, or animal waste is found at the checkout inspection; otherwise, the cleaning fee and any repair costs are deducted from it.

4. CARE OF PREMISES & DAMAGE LIABILITY

4.1 Space & Equipment Condition. The renter must leave the studio space, furniture, fixtures, and gear in the same condition as received at check-in.

4.2 Damage Liability (Art. 1667, Civil Code). The primary renter assumes full financial liability for any loss, breakage, or damage caused to the studio space, fixtures, backdrops, or equipment by the renter or by the renter's crew, clients, or guests during the rental window.

4.3 Minimum Assessment & Valuation. If studio property is damaged, the minimum liability fee billed to the renter is 100% of the total booked rental value or the actual total repair or replacement cost of the damaged item(s), whichever is higher.

4.4 Cleaning Fee. A fixed cleaning fee of ₱500 is charged when the studio is left dirty or needs cleaning beyond normal use.

4.5 Right of Retention on Files & Outputs (Art. 1731, Civil Code).
• Withholding of deliverables. Studio management may withhold all studio-produced photo deliverables, raw files, photobooth prints, and digital gallery access associated with the booking until all outstanding damage fees and cleaning fees are paid in full.
• Acknowledgement. By signing this agreement, the renter acknowledges and consents that photo delivery schedules are strictly contingent on full settlement of all outstanding balances and damage claims.

5. CAPACITY, SAFETY & PROTECTION OF MINORS

5.1 Maximum Capacity. Session length and capacity depend on the package booked:
• Package 1 (30 minutes): 1 to 2 persons
• Package 2 (30 minutes): 1 to 5 persons
• Package 3 (1 hour): up to 8 persons
Exceeding the package limit requires prior notice and may incur per-head or event-rate surcharges.
For hourly-rate rentals, the maximum occupancy is 8 persons. Each person beyond 8 is charged ₱500 per head.

5.2 Child Safety & Consent (RA 7610, RA 11930). Minors (under 18) must be accompanied by a parent or legal guardian. Shoots involving child models must fully comply with Philippine laws protecting minors from exploitation, and a signed parental or guardian consent form is required before the shoot.

5.3 Right to Stop a Session.
• The studio may stop a session at any time if it perceives a hazard, danger, or emergency.
• If the stoppage is not caused by the renter or the renter's party, the studio will provide a full refund where necessary.
• If the stoppage is caused by the renter or the renter's party, such as a fight or disturbance, no refund is given and the studio may hold or demand full payment of the rental fee and any other charges due.

6. NOISE, COMMON AREAS & BUILDING REGULATIONS

6.1 Sound & Building Rules. Sound levels and music must remain moderate out of respect for neighboring units and the surrounding commercial and residential areas.

6.2 Shared Spaces. Hallways, stairwells, fire exits, elevators, and building parking areas must be kept clear of equipment, bags, and personnel at all times.

7. SECURITY, PRIVACY & LIABILITY

7.1 Data Privacy (RA 10173). Personal details collected during booking (names, IDs, contact information) are processed securely and solely for reservation, security, and invoicing purposes, in compliance with the Data Privacy Act of 2012.

7.2 Data Retention & Renter Rights. Personal details and CCTV footage are stored for seven (7) days after the booking date and then deleted, except records the studio is required by law to keep (such as receipts and accounting records) or needs for an unresolved damage or payment claim. Renters may ask to access, correct, or delete their personal data by contacting the studio.

7.3 CCTV Surveillance. Closed-circuit television (CCTV) cameras operate at entrance points and in main studio areas for security and inventory monitoring. No cameras are installed in changing rooms, makeup areas, or restrooms.

7.4 Behind-the-Scenes Photos & Videos. The studio may take behind-the-scenes images and videos during sessions and post them on its social media pages and marketing materials. Renters who do not wish to be included must inform the studio in writing before the session. For minors, the studio will first ask permission from the parent or legal guardian present. No behind-the-scenes content is taken during nude or sensitive shoots.

7.5 Limitation of Liability. The studio is not responsible for lost, stolen, or damaged personal property, camera gear, or valuables brought onto the premises, except where the loss or damage is caused by the negligence or willful act of the studio or its personnel.

7.6 Indemnification. The renter agrees to hold the studio management and property owners harmless from claims, injuries, or liabilities arising from accidents caused by the renter's own equipment use, negligence, or unauthorized actions during the session.

7.7 Personal Injury. The studio is responsible for injuries caused by the negligence of its staff. The renter and the renter's crew, clients, and guests are responsible for injuries caused by their own actions, negligence, or equipment.

7.8 Left-Behind Items. Items left behind are held free of charge for 24 hours after the session. After that, a storage fee of ₱50 per day is charged until the items are claimed. Items still unclaimed after 30 calendar days will be disposed of.

7.9 Use of Session Photos. For shoots photographed by the studio, the studio may use the resulting photos for promotional purposes. Photos of minors are used only with the consent of a parent or legal guardian, and photos from nude or sensitive shoots only with separate written consent. For shoots where renters bring their own photographer or camera, the renter is free to decide whether to share the images with the studio or tag the studio.

8. GENERAL PROVISIONS

8.1 Governing Law & Venue. This agreement is governed by the laws of the Republic of the Philippines. Any dispute arising from it shall be brought before the proper courts of Zamboanga City.

8.2 Entire Agreement. This manual, together with the booking confirmation, is the entire agreement between the studio and the renter for the booking.

8.3 Amendments. The studio may update this manual at any time. The version in effect when a booking is confirmed applies to that booking.

8.4 Severability. If any provision of this manual is found invalid or unenforceable, the remaining provisions stay in full effect.

9. ACKNOWLEDGEMENT & SIGNATURE

By signing below, the renter confirms having read, understood, and agreed to this Studio Policy Manual & Client Agreement.$policy$
where id;

-- ---------------------------------------------------------------------------
-- 3. Balance payments by Maya or bank transfer (InstaPay/PESONet)
-- ---------------------------------------------------------------------------
alter table public.payments drop constraint payments_provider_check;
alter table public.payments
  add constraint payments_provider_check
    check (provider in ('paymongo', 'gcash', 'maya', 'bank_transfer', 'cash'));

-- ---------------------------------------------------------------------------
-- 4. ₱500 rescheduling fee on studio packages that had none
-- ---------------------------------------------------------------------------
update public.services
set reschedule_fee_cents = 50000
where booking_category = 'studio' and reschedule_fee_cents = 0;
