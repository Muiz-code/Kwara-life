// The person behind the counter in each kind of place: what they are called, and what they say when you
// stop to talk. Lines only; no player chat (CLAUDE.md). Never name a party or a real person.

export interface CounterRole {
  /** "the teller", "Mama": used as "Talk to {who}". */
  who: string;
  /** What the counter is, for the menu header. */
  label: string;
  lines: string[];
}

export const COUNTER_ROLES: Record<string, CounterRole> = {
  bank: {
    who: "the teller",
    label: "Teller",
    lines: [
      "Good afternoon. Please fill the slip and write your account number well.",
      "Network is a bit slow today. Just bear with us small.",
      "If it's transfer you want, our app can do it from your house o.",
    ],
  },
  inec: {
    who: "the VINEC officer",
    label: "VINEC officer",
    lines: [
      "Bring your details. Registration is free, nobody should collect money from you.",
      "Your PVC is your power. Come and collect it once collection opens.",
      "On election day, go to your own polling unit. Not another person's own.",
    ],
  },
  hotel: {
    who: "the receptionist",
    label: "Reception",
    lines: [
      "Welcome! We have rooms with AC and steady light. Will you be staying the night?",
      "Breakfast is from 7. Na plantain and egg today.",
      "Your key is ready. Room 12, first floor, by the stairs.",
    ],
  },
  shop: {
    who: "the shop attendant",
    label: "Counter",
    lines: [
      "Customer! Wetin you dey find? We get am.",
      "This one na original, no be China copy. I fit give you small discount.",
      "Last price? Ah, my oga go kill me. Okay, for you.",
    ],
  },
  office: {
    who: "the receptionist",
    label: "Reception",
    lines: [
      "Good morning. Who are you here to see? Please sign the visitors' book.",
      "Oga is in a meeting. You can wait on the bench.",
      "Drop your CV here, they will call you.",
    ],
  },
  hall: {
    who: "the organiser",
    label: "Organiser",
    lines: [
      "The session starts soon. Sit anywhere, all of us are equal here.",
      "Today we are talking about how to check your name on the voters' register.",
      "Ask your question, no question is too small.",
    ],
  },
  classroom: {
    who: "the teacher",
    label: "Teacher",
    lines: [
      "Good day. Today's topic is on the board, copy it down.",
      "Education is the key. Make sure you finish what you start.",
      "Next week we have a test. Read your notes.",
    ],
  },
  buka: {
    who: "Mama",
    label: "Mama at the pots",
    lines: [
      "My customer! Wetin you go chop today? Amala dey, rice dey.",
      "Sit down, I go bring am. You want am with ponmo?",
      "Soup don sweet today, I put correct pepper.",
    ],
  },
  supermarket: {
    who: "the cashier",
    label: "Checkout",
    lines: [
      "Next customer please. Card or transfer?",
      "Do you want a nylon bag? Na fifty naira.",
      "Please check your receipt before you go.",
    ],
  },
  boutique: {
    who: "the tailor",
    label: "Tailor",
    lines: [
      "Come make I take your measurement. You go shine for that owambe.",
      "This lace na correct quality. E no dey fade.",
      "Come back on Friday. E go ready, I promise.",
    ],
  },
  showroom: {
    who: "the salesman",
    label: "Sales desk",
    lines: [
      "Oga, this one na tokunbo, direct from Cotonou. Clean, no accident.",
      "We fit do small payment plan if you like.",
      "Take am for test drive, you go love am.",
    ],
  },
  techhub: {
    who: "the receptionist",
    label: "Reception",
    lines: [
      "Hi! Are you here for an interview or a meeting? The wifi password is on the wall.",
      "We are always hiring good people. Check the openings on your phone.",
      "Founders pitch on Thursdays. Bring your deck.",
    ],
  },
  club: {
    who: "the bartender",
    label: "Bar",
    lines: [
      "Wetin you dey drink? Chapman, malt or something strong?",
      "DJ go play your song next, just dey here.",
      "Drink responsibly o. Make you reach house safe.",
    ],
  },
  lounge: {
    who: "the bartender",
    label: "Bar",
    lines: [
      "Cold drinks dey. Pepper soup dey come out soon.",
      "Match go start by 8. Come early make you get seat.",
      "The suya man dey outside if you want.",
    ],
  },
  viewing: {
    who: "the operator",
    label: "Gate",
    lines: [
      "Na one hundred naira to enter. Today's match na derby!",
      "Sit down quietly, no shouting during the news.",
      "NEPA take light? No worry, generator dey.",
    ],
  },
  station: {
    who: "the ticket officer",
    label: "Ticket office",
    lines: [
      "Where you dey go? Show me your ID for the manifest.",
      "The next one dey leave in thirty minutes. Load fast.",
      "Keep your ticket safe. No ticket, no seat.",
    ],
  },
  airport: {
    who: "the check-in agent",
    label: "Check-in",
    lines: [
      "Passport or ID, please. Any bag to check in?",
      "Boarding starts forty minutes before the flight. Gate 2.",
      "Your bag is slightly overweight. Just this once.",
    ],
  },
  gallery: {
    who: "the guide",
    label: "Visitor desk",
    lines: [
      "Welcome! This place has stood longer than any of us. Take your time.",
      "The art on the walls is from businesses in town. Your own can hang there too.",
      "No flash photos near the old pieces, please.",
    ],
  },
  takeaway: {
    who: "the server",
    label: "Order counter",
    lines: [
      "Next! What will you take? Jollof, fried rice, shawarma?",
      "Na take-away only o. Pack am go house, e still hot.",
      "Your number don ready! Number twelve!",
    ],
  },
  cafe: {
    who: "the server",
    label: "Counter",
    lines: [
      "Welcome! Mango and granola is our special today.",
      "Find a table, I'll bring it over.",
      "You two look lovely. Table by the window is free.",
    ],
  },
};
