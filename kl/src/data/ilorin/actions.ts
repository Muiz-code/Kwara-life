// Every action you can take at a place. Ported from reference/kwara-life.html.

import type { Action } from "../action";

export type { Action, GoalId, OnceFlag } from "../action";

export const HOME_ACTIONS: Action[] = [
  { id: "sleep", label: "Sleep", dur: 480, sleep: true, fx: { energy: 100 }, home: true, bubble: "Zzz", done: "You slept for 8 hours." },
  { id: "nap", label: "Take a nap", dur: 90, sleep: true, fx: { energy: 30 }, home: true, bubble: "Zzz", done: "Short nap. You feel a bit better." },
  { id: "bath", label: "Take a bath", dur: 30, fx: { hygiene: 70 }, home: true, water: true, bubble: "Splash", done: "You had a cold bath." },
  { id: "cook", label: "Cook Indomie and egg", dur: 40, fx: { food: 45 }, home: true, usesFood: true, bubble: "Cooking", done: "Indomie and egg, the classic." },
  { id: "tv", label: "Watch Africa Magic", dur: 60, fx: { fun: 22 }, home: true, light: true, bubble: "TV", done: "You watched a Yoruba film." },
  { id: "phone", label: "Scroll WhatsApp status", dur: 30, fx: { fun: 8, social: 6 }, home: true, bubble: "Scrolling", done: "You caught up on everyone's status." },
];

const rent = (cost: number): Action => ({
  id: "rent", label: "Pay a year's rent and move in", dur: 120, cost, rent: true, fx: { fun: 20 }, bubble: "New keys!", done: "You moved into your new place.",
});

export const ESTATE_RENT: Record<string, number> = { adewole: 250000, irewolede: 150000, evergreen: 450000 };

export const ACTIONS: Record<string, Action[]> = {
  po: [
    { id: "pos", label: "Run a POS stand under the bridge", dur: 240, earn: 4500, fx: { energy: -15, social: 10, hygiene: -10 }, bubble: "Withdrawals", done: "You ran a POS stand under the bridge for 4 hours." },
    { id: "suya", label: "Buy suya", dur: 20, cost: 1500, hours: [17, 24], fx: { food: 22, fun: 6 }, bubble: "Suya", done: "Hot suya with extra yaji." },
    { id: "people", label: "Watch the junction madness", dur: 30, fx: { fun: 8 }, bubble: "Watching", done: "Kekes, hawkers and one man selling everything." },
  ],
  palace: [
    { id: "pray", label: "Pray at the Central Mosque", dur: 30, fx: { fun: 8, social: 5 }, bubble: "Praying", done: "You prayed and feel calm." },
    { id: "jummah", label: "Attend Jummah", dur: 90, day: 4, hours: [12, 15], fx: { social: 25, fun: 10 }, bubble: "Jummah", done: "Jummah service. You greeted half of Ilorin." },
    { id: "visit", label: "Visit the Emir's palace", dur: 60, hours: [8, 20], noDay: 6, fx: { fun: 15 }, bubble: "Sightseeing", done: "You toured the palace grounds in your best clothes." },
    { id: "horse", label: "Hire a Durbar horse for the day", dur: 30, cost: 5000, horse: true, fx: { fun: 15 }, bubble: "Neigh!", done: "You hired a decorated Durbar horse. Ride it anywhere today." },
    { id: "food", label: "Buy foodstuff at Oja Oba", dur: 40, cost: 2000, groc: 3, fx: {}, bubble: "Pricing", done: "You priced well and bought foodstuff for 3 meals." },
    { id: "fabric", label: "Price aso-oke fabric", dur: 30, fx: { fun: 8 }, bubble: "Pricing", done: "Beautiful aso-oke. Next month, maybe." },
  ],
  adabata: [
    { id: "mamaput", label: "Eat at a mama put", dur: 30, cost: 1200, fx: { food: 40 }, bubble: "Eating", done: "Rice, beans and plantain at the mama put." },
    { id: "elders", label: "Gist with elders under the tree", dur: 60, fx: { social: 15, fun: 6 }, bubble: "Gisting", done: "The elders told you stories about old Ilorin." },
    { id: "naming", label: "Attend a naming ceremony", dur: 150, days: [5, 6], hours: [8, 13], fx: { social: 25, food: 30, fun: 15 }, bubble: "Barka!", done: "Naming ceremony. Plenty food and prayers." },
  ],
  taiwo: [
    { id: "gadgets", label: "Window-shop gadgets", dur: 45, fx: { fun: 10 }, bubble: "Looking", done: "You looked at phones you can't afford yet." },
    { id: "screen", label: "Fix your cracked phone screen", dur: 60, cost: 5000, fx: { fun: 10 }, bubble: "Fixing", done: "New screen. Your phone looks brand new." },
    { id: "newphone", label: "Buy a new phone", dur: 60, cost: 60000, goal: "phone", fx: { fun: 40, social: 10 }, bubble: "New phone!", done: "You bought a new phone at Taiwo Oke." },
  ],
  stadium: [
    { id: "ball", label: "Play football with Tunde", dur: 90, hours: [16, 19], fx: { fun: 30, social: 15, energy: -20, hygiene: -25 }, friend: "tunde", bubble: "Goal!", done: "You played ball with Tunde outside the gate." },
    { id: "match", label: "Watch Kwara United play", dur: 120, cost: 1000, days: [5, 6], hours: [15, 18], fx: { fun: 35, social: 15 }, bubble: "Up Kwara!", done: "Kwara United won at home. The stadium shook." },
    { id: "jog", label: "Jog round the track", dur: 45, fx: { fun: 8, energy: -12, hygiene: -20 }, bubble: "Jogging", done: "Four laps of the track." },
  ],
  sawmill: [
    { id: "wara", label: "Buy wara and kulikuli", dur: 20, cost: 800, fx: { food: 20, fun: 5 }, bubble: "Snacking", done: "Fried wara and kulikuli from the garage hawkers." },
    { id: "load", label: "Help load a Lagos bus", dur: 180, earn: 2500, fx: { energy: -18, social: 8, hygiene: -12 }, bubble: "Lifting", done: "You loaded bags onto the Lagos bus all afternoon." },
    { id: "haircut", label: "Get a haircut", dur: 40, cost: 700, fx: { hygiene: 15, fun: 5 }, bubble: "Trimming", done: "Fresh cut from the garage barber." },
  ],
  adewole: [rent(ESTATE_RENT.adewole), ...HOME_ACTIONS],
  airport: [
    { id: "planes", label: "Watch planes land", dur: 45, fx: { fun: 10 }, bubble: "Watching", done: "You watched the evening flight from Lagos land." },
    { id: "cousin", label: "Pick up your cousin", dur: 90, hours: [10, 18], fx: { social: 20, fun: 5 }, tip: 2000, bubble: "Welcome!", done: "You picked up your cousin from the Lagos flight. She dashed you ₦2,000." },
    { id: "fly", label: "Fly to Lagos for the weekend", dur: 1440, cost: 95000, goal: "fly", fx: { fun: 100, social: 40, energy: -20 }, bubble: "Flying", done: "You flew to Lagos, saw the city, and came back to Ilorin happy." },
  ],
  metro: [
    { id: "chill", label: "Hang out at the square", dur: 60, fx: { fun: 12, social: 6 }, bubble: "Chilling", done: "You relaxed at Metro Square." },
    { id: "concert", label: "Go to a concert", dur: 180, cost: 2000, days: [5, 6], hours: [18, 23], fx: { fun: 45, social: 20, energy: -15 }, bubble: "Dancing", done: "Big concert at the square. Your legs are finished." },
  ],
  irewolede: [rent(ESTATE_RENT.irewolede), ...HOME_ACTIONS],
  secretariat: [
    { id: "apply", label: "Submit your CV", dur: 90, once: "applied", fx: { social: 5 }, bubble: "Filing", done: "You submitted your CV. They said to resume tomorrow." },
    { id: "work", label: "Work a civil service shift", dur: 480, job: true, weekdays: true, hours: [8, 10], earn: 7000, fx: { energy: -25, fun: -10, social: 10 }, bubble: "Working", done: "A full day at the ministry. Files, meetings and tea." },
  ],
  hotel: [
    { id: "swim", label: "Swim in the pool", dur: 60, cost: 2000, fx: { fun: 25, energy: -10, hygiene: 10 }, bubble: "Splash", done: "You swam laps in the Kwara Hotel pool." },
    { id: "gym", label: "Work out at the gym", dur: 60, cost: 1500, fx: { fun: 10, energy: -15, hygiene: -10 }, bubble: "Lifting", done: "Treadmill and weights. You feel strong." },
    { id: "drink", label: "Poolside chapman", dur: 30, cost: 1200, fx: { fun: 12, social: 6 }, bubble: "Sipping", done: "Cold chapman by the pool." },
  ],
  hub: [
    { id: "learn", label: "Learn to code", dur: 120, fx: { energy: -10, fun: -4 }, skill: 1, bubble: "Coding", done: "You worked through a coding tutorial." },
    { id: "gig", label: "Do a freelance gig", dur: 240, earn: 15000, minSkill: 3, fx: { energy: -22, fun: -5 }, bubble: "Shipping", done: "You built a landing page for a client." },
    { id: "kayode", label: "Gist with Kayode", dur: 40, fx: { social: 15, fun: 8 }, friend: "kayode", bubble: "Gisting", done: "You gisted with Kayode." },
  ],
  govhouse: [
    { id: "townhall", label: "Attend a youth town hall", dur: 120, day: 2, hours: [10, 13], fx: { social: 20, fun: 10 }, bubble: "Listening", done: "You asked a question at the youth town hall." },
    { id: "photo", label: "Take a photo by the gate", dur: 15, fx: { fun: 6 }, bubble: "Snap", done: "Nice picture. Security told you to move along." },
  ],
  flower: [
    { id: "picnic", label: "Have a picnic", dur: 90, cost: 1500, hours: [10, 21], fx: { fun: 25, social: 12, food: 10 }, bubble: "Picnic", done: "Picnic under the trees at Flower Garden." },
    { id: "walk", label: "Evening walk under the lights", dur: 45, hours: [17, 22], fx: { fun: 15 }, bubble: "Strolling", done: "The garden lights are beautiful at night." },
  ],
  amala: [
    { id: "amala", label: "Amala, ewedu and goat meat", dur: 40, cost: 2500, fx: { food: 60, fun: 6 }, bubble: "Eating", done: "Amala, ewedu, gbegiri and goat meat. Perfect." },
    { id: "zobo", label: "Drink cold zobo", dur: 15, cost: 500, fx: { fun: 5, food: 5 }, bubble: "Sipping", done: "Cold zobo on a hot afternoon." },
    { id: "basira", label: "Gist with Mama Basira", dur: 30, fx: { social: 12 }, friend: "basira", bubble: "Gisting", done: "You gisted with Mama Basira." },
  ],
  mall: [
    { id: "movie", label: "Watch a movie", dur: 150, cost: 3500, fx: { fun: 40, social: 5 }, bubble: "Popcorn", done: "You watched a movie at the cinema." },
    { id: "melbourne", label: "Dinner at Melbourne", dur: 120, cost: 12000, hours: [14, 24], fx: { food: 55, fun: 35, social: 15 }, bubble: "Fine dining", done: "Candlelit dinner at Melbourne. Very soft life." },
    { id: "coldstone", label: "Cold Stone ice cream", dur: 20, cost: 2500, fx: { fun: 15, food: 8 }, bubble: "Yum", done: "Cold Stone ice cream with all the toppings." },
    { id: "snooker", label: "Play snooker", dur: 60, cost: 1000, fx: { fun: 20, social: 10 }, bubble: "Potting", done: "You played snooker and potted the black." },
    { id: "groc", label: "Buy groceries", dur: 30, cost: 3000, groc: 4, fx: {}, bubble: "Shopping", done: "You bought foodstuff for 4 meals." },
  ],
  froyo: [
    { id: "yogurt", label: "Frozen yogurt cup", dur: 30, cost: 3000, fx: { fun: 20, food: 10 }, bubble: "Yum", done: "Frozen yogurt with mango and granola." },
    { id: "tart", label: "Fruit tart", dur: 20, cost: 2000, fx: { food: 15, fun: 10 }, bubble: "Yum", done: "Crisp fruit tart. A little moment of joy." },
    { id: "date", label: "Take someone on a date", dur: 90, cost: 6000, fx: { fun: 25, social: 25 }, bubble: "Date night", done: "Lovely date at Frozencup." },
  ],
  home: [...HOME_ACTIONS],
  item7: [
    { id: "jollof", label: "Jollof rice and chicken", dur: 30, cost: 2200, fx: { food: 55, fun: 5 }, bubble: "Eating", done: "Item 7 jollof with chicken and dodo." },
    { id: "shawarma", label: "Chicken shawarma", dur: 20, cost: 2500, fx: { food: 40, fun: 8 }, bubble: "Eating", done: "Chicken shawarma, double sausage." },
    { id: "aisha2", label: "Gist with Aisha", dur: 40, hours: [12, 20], fx: { social: 18, fun: 6 }, friend: "aisha", bubble: "Gisting", done: "You ran into Aisha in the Item 7 queue." },
  ],
  okeodo: [
    { id: "food", label: "Buy foodstuff at the junction", dur: 30, cost: 1800, groc: 3, fx: {}, bubble: "Pricing", done: "Foodstuff for 3 meals from Oke-Odo." },
    { id: "hustle", label: "Sell data to students", dur: 180, earn: 2000, fx: { social: 15, energy: -10 }, bubble: "Selling", done: "You sold data bundles to students all afternoon." },
  ],
  unilorin: [
    { id: "lecture", label: "Attend a lecture", dur: 120, fx: { energy: -10, fun: -6 }, skill: 0.5, bubble: "Taking notes", done: "Two hours of lecture. Your brain is full." },
    { id: "aisha", label: "Gist with Aisha", dur: 45, fx: { social: 20, fun: 6 }, friend: "aisha", bubble: "Gisting", done: "You gisted with Aisha." },
    { id: "caf", label: "Eat at the cafeteria", dur: 30, cost: 900, fx: { food: 30 }, bubble: "Eating", done: "Rice and stew at the cafeteria." },
  ],
  evergreen: [rent(ESTATE_RENT.evergreen), ...HOME_ACTIONS],
  poly: [
    { id: "tutor", label: "Tutor ND students", dur: 120, earn: 5000, minSkill: 2, fx: { energy: -12, social: 12 }, bubble: "Teaching", done: "You tutored a class of ND students." },
    { id: "canteen", label: "Eat at the canteen", dur: 30, cost: 700, fx: { food: 30 }, bubble: "Eating", done: "Cheap rice and beans at the poly canteen." },
  ],
  shao: [
    { id: "corn", label: "Buy roasted corn and ube", dur: 20, cost: 500, fx: { food: 18, fun: 6 }, bubble: "Munching", done: "Roasted corn and ube by the roadside." },
    { id: "yam", label: "Buy yam tubers", dur: 30, cost: 3000, groc: 5, fx: {}, bubble: "Pricing", done: "Five fat yams, cheaper than in town." },
  ],
  farm: [
    { id: "mango", label: "Buy fresh mangoes", dur: 15, cost: 400, fx: { food: 10, fun: 5 }, bubble: "Mangoes", done: "Sweet roadside mangoes." },
    { id: "cattle", label: "Watch the Fulani cattle", dur: 30, fx: { fun: 10 }, bubble: "Moo", done: "The cattle crossed the road very slowly." },
  ],
  kwasu: [
    { id: "library", label: "Read at the big library", dur: 180, skill: 1, fx: { energy: -10, fun: -3 }, bubble: "Reading", done: "Three hours in the biggest library in West Africa." },
    { id: "seminar", label: "Attend a KWASU seminar", dur: 120, skill: 0.5, fx: { social: 12 }, bubble: "Learning", done: "Seminar on entrepreneurship at KWASU." },
    { id: "hostel", label: "Visit friends at the hostel", dur: 90, fx: { social: 25, fun: 15 }, bubble: "Gisting", done: "You visited old friends at the KWASU hostels." },
  ],
};

export function findAction(placeId: string, actionId: string): Action | undefined {
  return ACTIONS[placeId]?.find((a) => a.id === actionId);
}
