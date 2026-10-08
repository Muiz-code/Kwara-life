// Generated from reference/naija-votes-2027.html by scripts/gen-naija-data.mjs. Edit the data here from now on.
import type { Lang } from "./i18n";
import type { ZoneCode } from "./zones";
import { lookup } from "./lookup";

export type LandmarkKind = "bridge" | "forest" | "hills" | "market" | "palace" | "rock" | "tower" | "water";

export interface State {
  /** Stable id, e.g. "kwara", "akwa-ibom", "fct". */
  code: string;
  name: string;
  zone: ZoneCode;
  /** Slogan or what the state is known for. */
  slogan: string;
  /** Default UI language for citizens of this state. */
  lang: Lang;
  /** Five real LGAs (the prototype's set). */
  lgas: string[];
  /** Position on the results tile map. */
  grid: [col: number, row: number];
  landmark: { name: string; kind: LandmarkKind };
}

export const STATES: State[] = [
  { code: "abia", name: "Abia", zone: "SE", slogan: "Home of Aba made goods and Ariaria Market", lang: "ig", lgas: ["Aba North","Aba South","Umuahia North","Ohafia","Arochukwu"], grid: [5, 6], landmark: { name: "Ariaria Market", kind: "market" } },
  { code: "adamawa", name: "Adamawa", zone: "NE", slogan: "Land of the Mandara Mountains and Sukur", lang: "ha", lgas: ["Yola North","Yola South","Mubi North","Numan","Ganye"], grid: [7, 2], landmark: { name: "Mandara Mountains", kind: "hills" } },
  { code: "akwa-ibom", name: "Akwa Ibom", zone: "SS", slogan: "Land of Promise, home of afang soup", lang: "pcm", lgas: ["Uyo","Eket","Ikot Ekpene","Oron","Abak"], grid: [6, 6], landmark: { name: "Ibom Tropicana", kind: "tower" } },
  { code: "anambra", name: "Anambra", zone: "SE", slogan: "Light of the Nation, Onitsha Main Market", lang: "ig", lgas: ["Awka South","Onitsha North","Nnewi North","Ekwusigo","Ihiala"], grid: [3, 6], landmark: { name: "Onitsha Main Market", kind: "market" } },
  { code: "bauchi", name: "Bauchi", zone: "NE", slogan: "Pearl of Tourism, Yankari Game Reserve", lang: "ha", lgas: ["Bauchi","Katagum","Misau","Tafawa Balewa","Alkaleri"], grid: [5, 2], landmark: { name: "Yankari Game Reserve", kind: "forest" } },
  { code: "bayelsa", name: "Bayelsa", zone: "SS", slogan: "Glory of All Lands, creeks and Oxbow Lake", lang: "pcm", lgas: ["Yenagoa","Brass","Ogbia","Sagbama","Southern Ijaw"], grid: [2, 7], landmark: { name: "Oxbow Lake", kind: "water" } },
  { code: "benue", name: "Benue", zone: "NC", slogan: "Food Basket of the Nation", lang: "en", lgas: ["Makurdi","Gboko","Otukpo","Katsina-Ala","Vandeikya"], grid: [5, 4], landmark: { name: "River Benue", kind: "water" } },
  { code: "borno", name: "Borno", zone: "NE", slogan: "Home of Peace, by Lake Chad", lang: "ha", lgas: ["Maiduguri","Jere","Biu","Konduga","Bama"], grid: [7, 1], landmark: { name: "Shehu's Palace", kind: "palace" } },
  { code: "cross-river", name: "Cross River", zone: "SS", slogan: "People's Paradise, Obudu and the Calabar Carnival", lang: "pcm", lgas: ["Calabar Municipal","Calabar South","Ikom","Ogoja","Obudu"], grid: [6, 5], landmark: { name: "Obudu Mountain Resort", kind: "hills" } },
  { code: "delta", name: "Delta", zone: "SS", slogan: "The Big Heart", lang: "pcm", lgas: ["Oshimili South","Warri South","Uvwie","Ughelli North","Sapele"], grid: [2, 6], landmark: { name: "Niger Bridge, Asaba", kind: "bridge" } },
  { code: "ebonyi", name: "Ebonyi", zone: "SE", slogan: "Salt of the Nation", lang: "ig", lgas: ["Abakaliki","Afikpo North","Ezza North","Ikwo","Ohaukwu"], grid: [5, 5], landmark: { name: "Uburu Salt Lake", kind: "water" } },
  { code: "edo", name: "Edo", zone: "SS", slogan: "Heartbeat of the Nation, Benin bronzes", lang: "pcm", lgas: ["Oredo","Egor","Ikpoba-Okha","Esan West","Etsako West"], grid: [3, 5], landmark: { name: "Oba's Palace", kind: "palace" } },
  { code: "ekiti", name: "Ekiti", zone: "SW", slogan: "Fountain of Knowledge, Ikogosi warm springs", lang: "yo", lgas: ["Ado Ekiti","Ikere","Ijero","Ikole","Efon"], grid: [2, 4], landmark: { name: "Ikogosi Warm Springs", kind: "water" } },
  { code: "enugu", name: "Enugu", zone: "SE", slogan: "Coal City State", lang: "ig", lgas: ["Enugu North","Enugu East","Nsukka","Udi","Oji River"], grid: [4, 5], landmark: { name: "Ngwo Pine Forest", kind: "forest" } },
  { code: "fct", name: "FCT", zone: "NC", slogan: "Centre of Unity, Aso Rock", lang: "en", lgas: ["Abuja Municipal","Bwari","Gwagwalada","Kuje","Kwali"], grid: [3, 3], landmark: { name: "Aso Rock", kind: "rock" } },
  { code: "gombe", name: "Gombe", zone: "NE", slogan: "Jewel in the Savannah", lang: "ha", lgas: ["Gombe","Akko","Billiri","Kaltungo","Dukku"], grid: [6, 2], landmark: { name: "Tula Hills", kind: "hills" } },
  { code: "imo", name: "Imo", zone: "SE", slogan: "Eastern Heartland, Oguta Lake", lang: "ig", lgas: ["Owerri Municipal","Owerri North","Okigwe","Orlu","Aboh Mbaise"], grid: [4, 6], landmark: { name: "Oguta Lake", kind: "water" } },
  { code: "jigawa", name: "Jigawa", zone: "NW", slogan: "The New World, Hadejia wetlands", lang: "ha", lgas: ["Dutse","Hadejia","Kazaure","Gumel","Birnin Kudu"], grid: [5, 0], landmark: { name: "Hadejia Wetlands", kind: "water" } },
  { code: "kaduna", name: "Kaduna", zone: "NW", slogan: "Centre of Learning", lang: "ha", lgas: ["Kaduna North","Kaduna South","Zaria","Jema'a","Chikun"], grid: [3, 2], landmark: { name: "Kajuru Castle", kind: "palace" } },
  { code: "kano", name: "Kano", zone: "NW", slogan: "Centre of Commerce, Kofar Mata dye pits", lang: "ha", lgas: ["Kano Municipal","Nassarawa","Fagge","Gwale","Dala"], grid: [4, 1], landmark: { name: "Kofar Mata Dye Pits", kind: "market" } },
  { code: "katsina", name: "Katsina", zone: "NW", slogan: "Home of Hospitality, Gobarau Minaret", lang: "ha", lgas: ["Katsina","Daura","Funtua","Malumfashi","Dutsin-Ma"], grid: [3, 0], landmark: { name: "Gobarau Minaret", kind: "tower" } },
  { code: "kebbi", name: "Kebbi", zone: "NW", slogan: "Land of Equity, Argungu Fishing Festival", lang: "ha", lgas: ["Birnin Kebbi","Argungu","Yauri","Zuru","Jega"], grid: [0, 1], landmark: { name: "Argungu Fishing Ground", kind: "water" } },
  { code: "kogi", name: "Kogi", zone: "NC", slogan: "Confluence State, Lokoja", lang: "en", lgas: ["Lokoja","Okene","Idah","Kabba/Bunu","Ankpa"], grid: [3, 4], landmark: { name: "Niger-Benue Confluence", kind: "water" } },
  { code: "kwara", name: "Kwara", zone: "NC", slogan: "State of Harmony", lang: "yo", lgas: ["Ilorin West","Ilorin East","Ilorin South","Offa","Moro"], grid: [1, 3], landmark: { name: "Emir's Palace, Ilorin", kind: "palace" } },
  { code: "lagos", name: "Lagos", zone: "SW", slogan: "Centre of Excellence", lang: "yo", lgas: ["Ikeja","Eti-Osa","Alimosho","Surulere","Lagos Island"], grid: [0, 6], landmark: { name: "Third Mainland Bridge", kind: "bridge" } },
  { code: "nasarawa", name: "Nasarawa", zone: "NC", slogan: "Home of Solid Minerals", lang: "en", lgas: ["Lafia","Keffi","Akwanga","Karu","Nasarawa"], grid: [4, 3], landmark: { name: "Farin Ruwa Falls", kind: "water" } },
  { code: "niger", name: "Niger", zone: "NC", slogan: "Power State, Kainji Dam", lang: "ha", lgas: ["Chanchaga","Bida","Suleja","Kontagora","Borgu"], grid: [1, 2], landmark: { name: "Zuma Rock", kind: "rock" } },
  { code: "ogun", name: "Ogun", zone: "SW", slogan: "Gateway State, Olumo Rock", lang: "yo", lgas: ["Abeokuta South","Abeokuta North","Ijebu Ode","Sagamu","Ado-Odo/Ota"], grid: [0, 5], landmark: { name: "Olumo Rock", kind: "rock" } },
  { code: "ondo", name: "Ondo", zone: "SW", slogan: "Sunshine State, Idanre Hills", lang: "yo", lgas: ["Akure South","Akure North","Ondo West","Owo","Okitipupa"], grid: [2, 5], landmark: { name: "Idanre Hills", kind: "hills" } },
  { code: "osun", name: "Osun", zone: "SW", slogan: "State of the Living Spring, Osun-Osogbo Grove", lang: "yo", lgas: ["Osogbo","Olorunda","Ife Central","Ilesa East","Iwo"], grid: [1, 4], landmark: { name: "Osun-Osogbo Sacred Grove", kind: "forest" } },
  { code: "oyo", name: "Oyo", zone: "SW", slogan: "Pace Setter State, Cocoa House Ibadan", lang: "yo", lgas: ["Ibadan North","Ibadan South-West","Ogbomosho North","Oyo East","Iseyin"], grid: [0, 4], landmark: { name: "Cocoa House, Ibadan", kind: "tower" } },
  { code: "plateau", name: "Plateau", zone: "NC", slogan: "Home of Peace and Tourism", lang: "en", lgas: ["Jos North","Jos South","Barkin Ladi","Pankshin","Shendam"], grid: [5, 3], landmark: { name: "Shere Hills", kind: "rock" } },
  { code: "rivers", name: "Rivers", zone: "SS", slogan: "Treasure Base of the Nation, Garden City", lang: "pcm", lgas: ["Port Harcourt","Obio/Akpor","Eleme","Bonny","Ikwerre"], grid: [3, 7], landmark: { name: "Bonny Waterfront", kind: "water" } },
  { code: "sokoto", name: "Sokoto", zone: "NW", slogan: "Seat of the Caliphate", lang: "ha", lgas: ["Sokoto North","Sokoto South","Wamako","Tambuwal","Gwadabawa"], grid: [1, 0], landmark: { name: "Sultan's Palace", kind: "palace" } },
  { code: "taraba", name: "Taraba", zone: "NE", slogan: "Nature's Gift to the Nation, Mambilla Plateau", lang: "ha", lgas: ["Jalingo","Wukari","Takum","Bali","Gashaka"], grid: [6, 3], landmark: { name: "Mambilla Plateau", kind: "hills" } },
  { code: "yobe", name: "Yobe", zone: "NE", slogan: "Pride of the Sahel", lang: "ha", lgas: ["Damaturu","Potiskum","Nguru","Bade","Geidam"], grid: [6, 0], landmark: { name: "Dagona Waterfowl Sanctuary", kind: "water" } },
  { code: "zamfara", name: "Zamfara", zone: "NW", slogan: "Farming is Our Pride", lang: "ha", lgas: ["Gusau","Kaura Namoda","Talata Mafara","Anka","Bungudu"], grid: [2, 1], landmark: { name: "Gusau Dam", kind: "water" } },
];

export const STATE = lookup(STATES, (s) => s.code);
