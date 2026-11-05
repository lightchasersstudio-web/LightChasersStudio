import type { ServiceCategory } from "@/lib/catalog";

/**
 * "How to prepare for your shoot" (/prepare). General advice only: nothing here
 * promises a studio policy (inclusions, delivery times, refunds). Edit freely.
 */
export type PrepareTip = { title: string; body: string };
export type PrepareSection = { id: string; title: string; tips: PrepareTip[] };

export const GENERAL_PREP: PrepareSection[] = [
  {
    id: "before",
    title: "Before the day",
    tips: [
      {
        title: "Share your ideas",
        body: "Send us a few photos you love (from Pinterest, Instagram or anywhere) so we can match the mood, colours and poses you're dreaming of.",
      },
      {
        title: "Check the weather",
        body: "Outdoor shoot? Look at the forecast a day or two before and message us if rain looks likely, so we can plan around it together.",
      },
      {
        title: "Get some rest",
        body: "A good night's sleep and plenty of water show in your skin and your smile. Avoid trying new skincare or haircuts right before the shoot.",
      },
    ],
  },
  {
    id: "wear",
    title: "What to wear",
    tips: [
      {
        title: "Pick a colour story",
        body: "Coordinate, don't match. Choose two or three colours that go together (soft neutrals, earthy tones or pastels) and spread them across everyone's outfits.",
      },
      {
        title: "Keep patterns simple",
        body: "Solid colours and small textures photograph best. Big logos, neon shades and busy prints pull attention away from faces.",
      },
      {
        title: "Wear what feels like you",
        body: "Comfortable, well-fitting clothes help you relax, and relaxed people make the best photos. Iron everything the night before.",
      },
      {
        title: "Mind your shoes",
        body: "Shoes show in full-length shots. Bring nicer ones to change into if you'll be walking to a location.",
      },
    ],
  },
  {
    id: "bring",
    title: "What to bring",
    tips: [
      {
        title: "A small touch-up kit",
        body: "Powder or blotting paper, lip colour, a comb, hair ties and safety pins. Zamboanga heat is real!",
      },
      {
        title: "Water and a snack",
        body: "Especially for longer sessions and for kids. A happy, fed little one is a cooperative little one.",
      },
      {
        title: "Meaningful props",
        body: "A favourite book, your pet, a family heirloom, your instrument: small personal things make photos feel like you.",
      },
    ],
  },
  {
    id: "day",
    title: "On the day",
    tips: [
      {
        title: "Arrive a little early",
        body: "Coming 10 to 15 minutes early gives you time to settle in, freshen up and change, so we start relaxed and on time.",
      },
      {
        title: "Have your reference ready",
        body: "Keep your booking reference handy (it's in your email and on your booking page) in case we need to look anything up.",
      },
      {
        title: "Relax and have fun",
        body: "You don't need to know how to pose. We'll guide you the whole way, so just enjoy the time together.",
      },
    ],
  },
];

/** Extra tips by kind of shoot. */
export const CATEGORY_PREP: Partial<Record<ServiceCategory, PrepareTip[]>> = {
  wedding: [
    {
      title: "Prenup: plan two looks",
      body: "One casual and one dressy outfit gives your gallery variety. Agree on the change of clothes and location timing with us beforehand.",
    },
    {
      title: "Wedding day: share the timeline",
      body: "Send us your programme, venue addresses and a list of must-have family groupings a week before, with a contact person for the day.",
    },
  ],
  portrait: [
    {
      title: "Plan around little ones",
      body: "Book a time when kids are usually rested and fed. Bring a favourite toy and a spare outfit for spills.",
    },
    {
      title: "Maternity: comfort first",
      body: "Flowing dresses and fitted tops both show off the bump beautifully. Bring a comfortable pair of slippers between shots.",
    },
  ],
  event: [
    {
      title: "Tell us who matters most",
      body: "Point out the VIPs (celebrant, parents, special guests) and the key moments, like the cake cutting or speeches, so we don't miss them.",
    },
    {
      title: "Share the programme",
      body: "A rough schedule helps us be in the right place at the right time.",
    },
  ],
  commercial: [
    {
      title: "Send a shot list",
      body: "List the products, angles and uses (website, Shopee, social media) you need, and any brand colours or style references.",
    },
    {
      title: "Prepare the products",
      body: "Bring clean, dust-free, label-straight items and a few spares in case one gets marked.",
    },
  ],
};
