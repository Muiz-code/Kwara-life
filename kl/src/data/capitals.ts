// State capitals (where interstate buses, flights and drives start and end) and airports with scheduled
// passenger flights. Coordinates are approximate city centres. Airport list needs a check before launch.

export interface Capital {
  name: string;
  lat: number;
  lng: number;
  /** Has an airport with scheduled passenger flights. */
  airport: boolean;
}

export const CAPITALS: Record<string, Capital> = {
  abia: { name: "Umuahia", lat: 5.532, lng: 7.486, airport: false },
  adamawa: { name: "Yola", lat: 9.2035, lng: 12.4954, airport: true },
  "akwa-ibom": { name: "Uyo", lat: 5.0377, lng: 7.9128, airport: true },
  anambra: { name: "Awka", lat: 6.2104, lng: 7.0741, airport: true },
  bauchi: { name: "Bauchi", lat: 10.3158, lng: 9.8442, airport: true },
  bayelsa: { name: "Yenagoa", lat: 4.9267, lng: 6.2676, airport: true },
  benue: { name: "Makurdi", lat: 7.7337, lng: 8.5214, airport: false },
  borno: { name: "Maiduguri", lat: 11.8311, lng: 13.151, airport: true },
  "cross-river": { name: "Calabar", lat: 4.9757, lng: 8.3417, airport: true },
  delta: { name: "Asaba", lat: 6.198, lng: 6.7319, airport: true },
  ebonyi: { name: "Abakaliki", lat: 6.3249, lng: 8.1137, airport: false },
  edo: { name: "Benin City", lat: 6.335, lng: 5.6037, airport: true },
  ekiti: { name: "Ado-Ekiti", lat: 7.6211, lng: 5.2215, airport: true },
  enugu: { name: "Enugu", lat: 6.4584, lng: 7.5464, airport: true },
  fct: { name: "Abuja", lat: 9.0579, lng: 7.4951, airport: true },
  gombe: { name: "Gombe", lat: 10.2897, lng: 11.1673, airport: true },
  imo: { name: "Owerri", lat: 5.4836, lng: 7.0333, airport: true },
  jigawa: { name: "Dutse", lat: 11.7562, lng: 9.3389, airport: true },
  kaduna: { name: "Kaduna", lat: 10.5105, lng: 7.4165, airport: true },
  kano: { name: "Kano", lat: 12.0022, lng: 8.592, airport: true },
  katsina: { name: "Katsina", lat: 12.9908, lng: 7.6018, airport: true },
  kebbi: { name: "Birnin Kebbi", lat: 12.4539, lng: 4.1975, airport: true },
  kogi: { name: "Lokoja", lat: 7.8023, lng: 6.7333, airport: false },
  kwara: { name: "Ilorin", lat: 8.4966, lng: 4.5421, airport: true },
  lagos: { name: "Ikeja", lat: 6.6018, lng: 3.3515, airport: true },
  nasarawa: { name: "Lafia", lat: 8.4939, lng: 8.5153, airport: false },
  niger: { name: "Minna", lat: 9.6139, lng: 6.5569, airport: true },
  ogun: { name: "Abeokuta", lat: 7.1475, lng: 3.3619, airport: false },
  ondo: { name: "Akure", lat: 7.2571, lng: 5.2058, airport: true },
  osun: { name: "Osogbo", lat: 7.7827, lng: 4.5418, airport: false },
  oyo: { name: "Ibadan", lat: 7.3775, lng: 3.947, airport: true },
  plateau: { name: "Jos", lat: 9.8965, lng: 8.8583, airport: true },
  rivers: { name: "Port Harcourt", lat: 4.8156, lng: 7.0498, airport: true },
  sokoto: { name: "Sokoto", lat: 13.0059, lng: 5.2476, airport: true },
  taraba: { name: "Jalingo", lat: 8.8937, lng: 11.3596, airport: false },
  yobe: { name: "Damaturu", lat: 11.747, lng: 11.9608, airport: false },
  zamfara: { name: "Gusau", lat: 12.1704, lng: 6.6641, airport: false },
};
