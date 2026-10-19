import type { DatabaseAdapter, KvCacheAdapter } from '../db/client';
import type { Place, PlaceCategory } from '../types/domain';
import { generateId } from '../lib/http';

export interface OpeningHoursSchedule {
  // Day of week: 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  open_days: number[];
  open_time: string; // HH:MM 24-hour format
  close_time: string; // HH:MM 24-hour format
  weekday_text?: string[];
  notes?: string;
}

export interface CuratedPlace {
  id: string;
  name: string;
  formatted_address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  rating: number;
  price_level?: number; // 1-4 ($ to $$$$)
  google_place_id?: string;
  website?: string | null;
  phone_number?: string | null;
  notes?: string | null;
  opening_hours: OpeningHoursSchedule;
  tags?: string[];
}

export interface OpeningHoursValidationResult {
  isValid: boolean;
  open: boolean;
  warning?: string;
  open_days?: string[];
  open_hours_summary?: string;
  suggested_alternatives?: Place[];
}

export interface ResolvePlaceInput {
  place_id?: string;
  external_place_id?: string;
  google_place_id?: string;
  name?: string;
  place_name?: string;
  formatted_address?: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  category?: PlaceCategory;
  rating?: number;
  website?: string | null;
  phone_number?: string | null;
  notes?: string | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Curated POI Catalog covering world-class destinations:
 * Kyoto, Tokyo, Paris, New York, London, Rome.
 */
export const CURATED_POI_CATALOG: CuratedPlace[] = [
  // --- KYOTO ---
  {
    id: 'place-fushimi',
    name: 'Fushimi Inari Taisha',
    formatted_address: '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto, 612-0882',
    city: 'Kyoto',
    country: 'Japan',
    lat: 34.9671,
    lng: 135.7727,
    category: 'attraction',
    rating: 4.8,
    price_level: 1,
    google_place_id: 'ChIJAz7XqI4JAWAR-6_l6n8Bnh4',
    website: 'http://inari.jp/',
    phone_number: '+81 75-641-7331',
    notes: 'Iconic Shinto shrine with thousands of vibrant vermilion torii gates winding up Mount Inari.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '00:00',
      close_time: '23:59',
      notes: 'Open 24 hours daily',
    },
    tags: ['shrine', 'torii', 'hiking', 'culture', 'kyoto'],
  },
  {
    id: 'place-kinkaku',
    name: 'Kinkaku-ji (Golden Pavilion)',
    formatted_address: '1 Kinkakujicho, Kita Ward, Kyoto, 603-8361',
    city: 'Kyoto',
    country: 'Japan',
    lat: 35.0394,
    lng: 135.7292,
    category: 'attraction',
    rating: 4.7,
    price_level: 1,
    google_place_id: 'ChIJ592tG24JAWAR7Vp4f6eG4k8',
    website: 'https://www.shokoku-ji.jp/kinkakuji/',
    phone_number: '+81 75-461-0013',
    notes: 'Zen Buddhist temple whose top two floors are completely covered in gold leaf.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '09:00',
      close_time: '17:00',
      notes: 'Open daily 9:00 AM - 5:00 PM',
    },
    tags: ['temple', 'zen', 'gold', 'garden', 'unesco', 'kyoto'],
  },
  {
    id: 'place-kiyomizu',
    name: 'Kiyomizu-dera',
    formatted_address: '1 Chome-294 Kiyomizu, Higashiyama Ward, Kyoto, 605-0862',
    city: 'Kyoto',
    country: 'Japan',
    lat: 34.9949,
    lng: 135.785,
    category: 'attraction',
    rating: 4.8,
    price_level: 1,
    google_place_id: 'ChIJL-1b6oIIAWAR-8l9s0W6ZpA',
    website: 'https://www.kiyomizudera.or.jp/',
    phone_number: '+81 75-551-1234',
    notes: 'Historic temple perched on Mount Otowa with panoramic views of Kyoto.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '06:00',
      close_time: '18:00',
      notes: 'Open daily 6:00 AM - 6:00 PM',
    },
    tags: ['temple', 'scenic', 'views', 'unesco', 'kyoto'],
  },
  {
    id: 'place-arashiyama',
    name: 'Arashiyama Bamboo Grove',
    formatted_address: 'Sagatenryuji, Ukyo Ward, Kyoto, 616-8385',
    city: 'Kyoto',
    country: 'Japan',
    lat: 35.0169,
    lng: 135.6713,
    category: 'attraction',
    rating: 4.6,
    price_level: 1,
    google_place_id: 'ChIJ9T6u5kL-AWARf7YvB0qBshE',
    website: null,
    phone_number: null,
    notes: 'Atmospheric path cutting through soaring natural bamboo stalks.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '00:00',
      close_time: '23:59',
      notes: 'Open 24 hours daily',
    },
    tags: ['nature', 'bamboo', 'walk', 'photo', 'kyoto'],
  },
  {
    id: 'place-tenryu',
    name: 'Tenryu-ji',
    formatted_address: '68 Sagatenryuji Susukinobabacho, Ukyo Ward, Kyoto, 616-8385',
    city: 'Kyoto',
    country: 'Japan',
    lat: 35.0158,
    lng: 135.6776,
    category: 'attraction',
    rating: 4.6,
    price_level: 1,
    google_place_id: 'ChIJ81aJ-0D-AWARh_g7aC2YqE8',
    website: 'http://www.tenryuji.com/',
    phone_number: '+81 75-881-1235',
    notes: 'UNESCO World Heritage Zen temple with famous 14th-century pond garden.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '08:30',
      close_time: '17:00',
      notes: 'Open daily 8:30 AM - 5:00 PM',
    },
    tags: ['zen', 'garden', 'temple', 'unesco', 'kyoto'],
  },
  {
    id: 'place-nishiki',
    name: 'Nishiki Market',
    formatted_address: 'Nakagyo Ward, Kyoto, 604-8055',
    city: 'Kyoto',
    country: 'Japan',
    lat: 35.005,
    lng: 135.7649,
    category: 'shopping',
    rating: 4.4,
    price_level: 2,
    google_place_id: 'ChIJFfL6m44IAWARiE_fJj1sY70',
    website: 'https://www.kyoto-nishiki.or.jp/',
    phone_number: '+81 75-211-3882',
    notes: 'Narrow 5-block shopping street known as Kyoto\'s Kitchen. Closed on Mondays.',
    opening_hours: {
      open_days: [0, 2, 3, 4, 5, 6], // Closed Monday (1)
      open_time: '09:30',
      close_time: '18:00',
      notes: 'Closed on Mondays. Open Tue-Sun 9:30 AM - 6:00 PM',
    },
    tags: ['market', 'street food', 'seafood', 'shopping', 'kyoto'],
  },
  {
    id: 'place-nijo',
    name: 'Nijo Castle',
    formatted_address: '541 Nijojocho, Nakagyo Ward, Kyoto, 604-8301',
    city: 'Kyoto',
    country: 'Japan',
    lat: 35.0142,
    lng: 135.7482,
    category: 'attraction',
    rating: 4.5,
    price_level: 2,
    google_place_id: 'ChIJn0fCgEwIAWARbA-p4c1XQ8c',
    website: 'https://nijo-jocastle.city.kyoto.lg.jp/',
    phone_number: '+81 75-841-0096',
    notes: 'Historic flatland castle famous for nightingale squeaking floors. Closed on Tuesdays.',
    opening_hours: {
      open_days: [0, 1, 3, 4, 5, 6], // Closed Tuesday (2)
      open_time: '08:45',
      close_time: '16:00',
      notes: 'Closed on Tuesdays. Open Wed-Mon 8:45 AM - 4:00 PM',
    },
    tags: ['castle', 'shogun', 'history', 'unesco', 'kyoto'],
  },
  {
    id: 'place-gion',
    name: 'Gion Geisha District',
    formatted_address: 'Gionmachi Minamigawa, Higashiyama Ward, Kyoto, 605-0074',
    city: 'Kyoto',
    country: 'Japan',
    lat: 35.0037,
    lng: 135.7772,
    category: 'attraction',
    rating: 4.6,
    price_level: 2,
    google_place_id: 'ChIJ2ZtEzoMIAWARpQfE6r7fJ34',
    website: null,
    phone_number: null,
    notes: 'Historic merchant district with preserved wooden machiya merchant houses and teahouses.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '00:00',
      close_time: '23:59',
      notes: 'Open 24 hours daily',
    },
    tags: ['geisha', 'culture', 'evening', 'walk', 'kyoto'],
  },
  {
    id: 'place-ichiran',
    name: 'Ichiran Kyoto Kawaramachi',
    formatted_address: '598 Uraderacho, Nakagyo Ward, Kyoto, 604-8041',
    city: 'Kyoto',
    country: 'Japan',
    lat: 35.0042,
    lng: 135.769,
    category: 'restaurant',
    rating: 4.5,
    price_level: 2,
    google_place_id: 'ChIJh85Z_Y8IAWARG2hS1pQk0Bw',
    website: 'https://ichiran.com/',
    phone_number: '+81 75-241-2205',
    notes: 'Classic tonkotsu ramen served in private focus-flavor dining booths.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '10:00',
      close_time: '23:00',
      notes: 'Open daily 10:00 AM - 11:00 PM',
    },
    tags: ['ramen', 'noodles', 'dinner', 'lunch', 'kyoto'],
  },
  {
    id: 'place-chao-chao',
    name: 'Chao Chao Gyoza Sanjo Kiyamachi',
    formatted_address: '117 Ishiyacho, Nakagyo Ward, Kyoto, 604-8002',
    city: 'Kyoto',
    country: 'Japan',
    lat: 35.0056,
    lng: 135.7709,
    category: 'restaurant',
    rating: 4.6,
    price_level: 1,
    google_place_id: 'ChIJO5Q9q48IAWAR9-lX3KfZK20',
    website: 'https://gyozakeikaku.com/',
    phone_number: '+81 75-241-0021',
    notes: 'Crispy pan-fried gyoza dumplings with diverse flavor fillings.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '11:30',
      close_time: '22:00',
      notes: 'Open daily 11:30 AM - 10:00 PM',
    },
    tags: ['gyoza', 'izakaya', 'dinner', 'kyoto'],
  },

  // --- TOKYO ---
  {
    id: 'place-sensoji',
    name: 'Senso-ji Temple',
    formatted_address: '2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032',
    city: 'Tokyo',
    country: 'Japan',
    lat: 35.7148,
    lng: 139.7967,
    category: 'attraction',
    rating: 4.7,
    price_level: 1,
    google_place_id: 'ChIJX9zB4mCLGGARL5R7Z0_c8tM',
    website: 'https://www.senso-ji.jp/',
    phone_number: '+81 3-3842-0181',
    notes: 'Ancient Buddhist temple in Asakusa, Tokyo\'s oldest and most significant temple.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '06:00',
      close_time: '17:00',
      notes: 'Main Hall open daily 6:00 AM - 5:00 PM',
    },
    tags: ['temple', 'asakusa', 'historic', 'tokyo'],
  },
  {
    id: 'place-tokyo-tower',
    name: 'Tokyo Tower',
    formatted_address: '4 Chome-2-8 Shibakoen, Minato City, Tokyo 105-0011',
    city: 'Tokyo',
    country: 'Japan',
    lat: 35.6586,
    lng: 139.7454,
    category: 'attraction',
    rating: 4.5,
    price_level: 2,
    google_place_id: 'ChIJj62QWqmLGGAR_ErQDfW64tA',
    website: 'https://www.tokyotower.co.jp/',
    phone_number: '+81 3-3433-5111',
    notes: 'Communications and observation tower in Minato ward inspired by Eiffel Tower.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '09:00',
      close_time: '23:00',
      notes: 'Open daily 9:00 AM - 11:00 PM',
    },
    tags: ['observatory', 'views', 'landmark', 'tokyo'],
  },
  {
    id: 'place-shibuya-crossing',
    name: 'Shibuya Crossing',
    formatted_address: '2 Chome-2-1 Dogenzaka, Shibuya City, Tokyo 150-0043',
    city: 'Tokyo',
    country: 'Japan',
    lat: 35.6595,
    lng: 139.7005,
    category: 'attraction',
    rating: 4.6,
    price_level: 1,
    google_place_id: 'ChIJV4A5k_SLGGARV3-wJ0e_uQI',
    website: null,
    phone_number: null,
    notes: 'The world\'s busiest pedestrian intersection, outside Shibuya Station.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '00:00',
      close_time: '23:59',
      notes: 'Open 24 hours daily',
    },
    tags: ['scramble', 'shibuya', 'neon', 'tokyo'],
  },
  {
    id: 'place-tsukiji',
    name: 'Tsukiji Outer Market',
    formatted_address: '4 Chome-16-2 Tsukiji, Chuo City, Tokyo 104-0045',
    city: 'Tokyo',
    country: 'Japan',
    lat: 35.6654,
    lng: 139.7707,
    category: 'shopping',
    rating: 4.4,
    price_level: 2,
    google_place_id: 'ChIJ57E_mJCLGGARXo5g_x2x140',
    website: 'https://www.tsukiji.or.jp/',
    phone_number: '+81 3-3541-9444',
    notes: 'Vibrant wholesale & retail market specializing in fresh seafood, sushi, and kitchenware. Closed Sun & Wed.',
    opening_hours: {
      open_days: [1, 2, 4, 5, 6], // Closed Sun (0), Wed (3)
      open_time: '06:00',
      close_time: '14:00',
      notes: 'Closed on Sundays and Wednesdays. Open Mon, Tue, Thu-Sat 6:00 AM - 2:00 PM',
    },
    tags: ['sushi', 'market', 'seafood', 'tokyo'],
  },

  // --- PARIS ---
  {
    id: 'place-eiffel',
    name: 'Eiffel Tower',
    formatted_address: 'Champ de Mars, 5 Av. Anatole France, 75007 Paris, France',
    city: 'Paris',
    country: 'France',
    lat: 48.8584,
    lng: 2.2945,
    category: 'attraction',
    rating: 4.7,
    price_level: 3,
    google_place_id: 'ChIJLU7jZClu5kcR4PcOOO6pZMw',
    website: 'https://www.toureiffel.paris/',
    phone_number: '+33 892 70 12 39',
    notes: 'Wrought-iron lattice tower on the Champ de Mars, global cultural icon of France.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '09:30',
      close_time: '23:45',
      notes: 'Open daily 9:30 AM - 11:45 PM',
    },
    tags: ['monument', 'landmark', 'views', 'paris'],
  },
  {
    id: 'place-louvre',
    name: 'Louvre Museum',
    formatted_address: 'Rue de Rivoli, 75001 Paris, France',
    city: 'Paris',
    country: 'France',
    lat: 48.8606,
    lng: 2.3376,
    category: 'attraction',
    rating: 4.7,
    price_level: 2,
    google_place_id: 'ChIJD3uTd9hx5kcR1IQondqGxmU',
    website: 'https://www.louvre.fr/',
    phone_number: '+33 1 40 20 50 50',
    notes: 'World\'s most-visited museum housing the Mona Lisa. Closed on Tuesdays.',
    opening_hours: {
      open_days: [0, 1, 3, 4, 5, 6], // Closed Tuesday (2)
      open_time: '09:00',
      close_time: '18:00',
      notes: 'Closed on Tuesdays. Open Wed-Mon 9:00 AM - 6:00 PM',
    },
    tags: ['museum', 'art', 'mona lisa', 'history', 'paris'],
  },
  {
    id: 'place-orsay',
    name: 'Musée d\'Orsay',
    formatted_address: '1 Rue de la Légion d\'Honneur, 75007 Paris, France',
    city: 'Paris',
    country: 'France',
    lat: 48.8599,
    lng: 2.3266,
    category: 'attraction',
    rating: 4.7,
    price_level: 2,
    google_place_id: 'ChIJW_L_jNlx5kcRJ2hMhG7g1sE',
    website: 'https://www.musee-orsay.fr/',
    phone_number: '+33 1 40 49 48 14',
    notes: 'Museum housed in the former Gare d\'Orsay railway station with largest impressionist collection. Closed on Mondays.',
    opening_hours: {
      open_days: [0, 2, 3, 4, 5, 6], // Closed Monday (1)
      open_time: '09:30',
      close_time: '18:00',
      notes: 'Closed on Mondays. Open Tue-Sun 9:30 AM - 6:00 PM',
    },
    tags: ['museum', 'impressionism', 'monet', 'paris'],
  },

  // --- NEW YORK ---
  {
    id: 'place-central-park',
    name: 'Central Park',
    formatted_address: 'New York, NY 10024, United States',
    city: 'New York',
    country: 'United States',
    lat: 40.7829,
    lng: -73.9654,
    category: 'attraction',
    rating: 4.8,
    price_level: 1,
    google_place_id: 'ChIJ4zGFAZpYwokRGUGph3VoPgU',
    website: 'https://www.centralparknyc.org/',
    phone_number: '+1 212-310-6600',
    notes: 'Expansive urban park between the Upper West and Upper East Sides of Manhattan.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '06:00',
      close_time: '23:59',
      notes: 'Open daily 6:00 AM - 1:00 AM',
    },
    tags: ['park', 'nature', 'walk', 'nyc'],
  },
  {
    id: 'place-met',
    name: 'The Metropolitan Museum of Art',
    formatted_address: '1000 5th Ave, New York, NY 10028, United States',
    city: 'New York',
    country: 'United States',
    lat: 40.7794,
    lng: -73.9632,
    category: 'attraction',
    rating: 4.8,
    price_level: 3,
    google_place_id: 'ChIJV4A5k_SLGGARV3-wJ0e_uNY',
    website: 'https://www.metmuseum.org/',
    phone_number: '+1 212-535-7710',
    notes: 'Iconic art museum on the eastern edge of Central Park. Closed on Wednesdays.',
    opening_hours: {
      open_days: [0, 1, 2, 4, 5, 6], // Closed Wednesday (3)
      open_time: '10:00',
      close_time: '17:00',
      notes: 'Closed on Wednesdays. Open Sun-Tue, Thu-Sat 10:00 AM - 5:00 PM',
    },
    tags: ['museum', 'art', 'culture', 'nyc'],
  },

  // --- LONDON ---
  {
    id: 'place-british-museum',
    name: 'British Museum',
    formatted_address: 'Great Russell St, Bloomsbury, London WC1B 3DG, United Kingdom',
    city: 'London',
    country: 'United Kingdom',
    lat: 51.5194,
    lng: -0.127,
    category: 'attraction',
    rating: 4.7,
    price_level: 1,
    google_place_id: 'ChIJw-X1k9cadkgRbV25dI3l2wM',
    website: 'https://www.britishmuseum.org/',
    phone_number: '+44 20 7323 8000',
    notes: 'World-renowned museum dedicated to human history, art and culture.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '10:00',
      close_time: '17:00',
      notes: 'Open daily 10:00 AM - 5:00 PM',
    },
    tags: ['museum', 'history', 'london'],
  },

  // --- ROME ---
  {
    id: 'place-colosseum',
    name: 'Colosseum',
    formatted_address: 'Piazza del Colosseo, 1, 00184 Roma RM, Italy',
    city: 'Rome',
    country: 'Italy',
    lat: 41.8902,
    lng: 12.4922,
    category: 'attraction',
    rating: 4.8,
    price_level: 2,
    google_place_id: 'ChIJd419Y5RhLxMRz9XvT0Q6g-E',
    website: 'https://parcocolosseo.it/',
    phone_number: '+39 06 3996 7700',
    notes: 'Ancient Roman amphitheatre and premier landmark of Rome.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '09:00',
      close_time: '16:30',
      notes: 'Open daily 9:00 AM - 4:30 PM',
    },
    tags: ['ancient', 'amphitheatre', 'rome'],
  },
  {
    id: 'place-vatican',
    name: 'Vatican Museums',
    formatted_address: '00120 Vatican City',
    city: 'Rome',
    country: 'Vatican City',
    lat: 41.9067,
    lng: 12.4534,
    category: 'attraction',
    rating: 4.7,
    price_level: 3,
    google_place_id: 'ChIJz2x_v1RhLxMRvP0uO8V1A10',
    website: 'https://www.museivaticani.va/',
    phone_number: '+39 06 6988 4676',
    notes: 'Christian and art museums located within the boundaries of Vatican City. Closed on Sundays.',
    opening_hours: {
      open_days: [1, 2, 3, 4, 5, 6], // Closed Sunday (0)
      open_time: '08:00',
      close_time: '19:00',
      notes: 'Closed on Sundays. Open Mon-Sat 8:00 AM - 7:00 PM',
    },
    tags: ['vatican', 'art', 'sistine chapel', 'rome'],
  },
];

/**
 * Searches places across existing DB places, curated offline POI catalog,
 * and optional OpenStreetMap Nominatim geocoding with KV caching.
 */
export async function searchPlaces(
  db: DatabaseAdapter,
  query: string,
  city?: string,
  kv?: KvCacheAdapter
): Promise<CuratedPlace[] | Place[]> {
  const trimmed = query.trim().toLowerCase();
  const trimmedCity = city?.trim().toLowerCase();

  const results: Map<string, any> = new Map();

  // 1. Search existing DB places
  try {
    let sql = 'SELECT * FROM places WHERE (LOWER(name) LIKE ? OR LOWER(formatted_address) LIKE ?)';
    const params: any[] = [`%${trimmed}%`, `%${trimmed}%`];
    if (trimmedCity) {
      sql += ' AND LOWER(formatted_address) LIKE ?';
      params.push(`%${trimmedCity}%`);
    }
    const dbPlaces = await db.query<Place>(sql, params);
    for (const p of dbPlaces) {
      // Find matching catalog entry to attach opening hours
      const curatedMatch = CURATED_POI_CATALOG.find(
        (c) => c.name.toLowerCase() === p.name.toLowerCase() || c.id === p.id
      );
      results.set(p.name.toLowerCase(), {
        ...p,
        opening_hours: curatedMatch?.opening_hours,
      });
    }
  } catch {
    // If DB fails, proceed to catalog
  }

  // 2. Search Curated POI Catalog
  for (const item of CURATED_POI_CATALOG) {
    if (trimmedCity && item.city.toLowerCase() !== trimmedCity && !item.formatted_address.toLowerCase().includes(trimmedCity)) {
      continue;
    }
    const nameMatch = item.name.toLowerCase().includes(trimmed);
    const addressMatch = item.formatted_address.toLowerCase().includes(trimmed);
    const categoryMatch = item.category.toLowerCase().includes(trimmed);
    const tagMatch = item.tags?.some((t) => t.toLowerCase().includes(trimmed));

    if (nameMatch || addressMatch || categoryMatch || tagMatch) {
      const key = item.name.toLowerCase();
      if (!results.has(key)) {
        results.set(key, item);
      }
    }
  }

  // 3. Fallback: OpenStreetMap Nominatim Geocoder with Cloudflare KV Caching
  if (results.size < 3 && trimmed.length > 2) {
    const cacheKey = `nominatim:${trimmed}:${trimmedCity || ''}`;
    let cachedJson: string | null = null;

    if (kv) {
      try {
        cachedJson = await kv.get(cacheKey);
      } catch {
        // Cache miss
      }
    }

    if (cachedJson) {
      try {
        const parsed = JSON.parse(cachedJson);
        for (const item of parsed) {
          const key = item.name.toLowerCase();
          if (!results.has(key)) {
            results.set(key, item);
          }
        }
      } catch {
        // Invalid cache JSON
      }
    } else {
      try {
        const searchQuery = trimmedCity ? `${trimmed}, ${trimmedCity}` : trimmed;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          searchQuery
        )}&format=json&addressdetails=1&limit=5`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'TripPlanner/1.0 (contact@tripplanner.dev)',
            Accept: 'application/json',
          },
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = (await response.json()) as any[];
          const geoItems: CuratedPlace[] = data.map((item, index) => {
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            const name = item.name || item.display_name.split(',')[0];
            return {
              id: `osm-${item.osm_id || index}-${Date.now()}`,
              name,
              formatted_address: item.display_name,
              city: item.address?.city || item.address?.town || city || 'Unknown City',
              country: item.address?.country || 'Unknown Country',
              lat,
              lng,
              category: 'attraction',
              rating: 4.5,
              opening_hours: {
                open_days: [0, 1, 2, 3, 4, 5, 6],
                open_time: '09:00',
                close_time: '18:00',
              },
            };
          });

          if (kv && geoItems.length > 0) {
            await kv.put(cacheKey, JSON.stringify(geoItems), { expirationTtl: 86400 });
          }

          for (const item of geoItems) {
            const key = item.name.toLowerCase();
            if (!results.has(key)) {
              results.set(key, item);
            }
          }
        }
      } catch {
        // Offline or test environment: ignore fallback gracefully
      }
    }
  }

  return Array.from(results.values());
}

/**
 * Resolves a place from DB, catalog, or creates a new place record in the places table.
 */
export async function resolveOrCreatePlace(
  db: DatabaseAdapter,
  input: ResolvePlaceInput
): Promise<Place> {
  // 1. By ID
  if (input.place_id) {
    const existing = await db.queryOne<Place>('SELECT * FROM places WHERE id = ?', [input.place_id]);
    if (existing) return existing;
  }

  // 2. By Google Place ID
  const extId = input.external_place_id || input.google_place_id;
  if (extId) {
    const existing = await db.queryOne<Place>('SELECT * FROM places WHERE google_place_id = ?', [extId]);
    if (existing) return existing;
  }

  // 3. By Name and Address/City
  const name = input.name || input.place_name;
  if (name) {
    const existing = await db.queryOne<Place>(
      'SELECT * FROM places WHERE LOWER(name) = LOWER(?)',
      [name.trim()]
    );
    if (existing) return existing;
  }

  // 4. Look up in Curated POI Catalog
  let candidate: CuratedPlace | undefined;
  if (input.place_id) {
    candidate = CURATED_POI_CATALOG.find((c) => c.id === input.place_id);
  }
  if (!candidate && name) {
    candidate = CURATED_POI_CATALOG.find(
      (c) => c.name.toLowerCase() === name.trim().toLowerCase()
    );
  }

  const id = input.place_id || candidate?.id || generateId('place');
  const placeName = name || candidate?.name || 'Custom Place';
  const formattedAddress =
    input.formatted_address || input.address || candidate?.formatted_address || (input.city ? `${placeName}, ${input.city}` : placeName);
  const lat = input.lat ?? candidate?.lat ?? 35.0116; // default Kyoto center if none
  const lng = input.lng ?? candidate?.lng ?? 135.7681;
  const category: PlaceCategory = input.category || candidate?.category || 'attraction';
  const rating = input.rating ?? candidate?.rating ?? 4.5;
  const googlePlaceId = extId || candidate?.google_place_id || null;
  const website = input.website ?? candidate?.website ?? null;
  const phoneNumber = input.phone_number ?? candidate?.phone_number ?? null;
  const notes = input.notes ?? candidate?.notes ?? null;

  // Insert into DB
  await db.execute(
    `INSERT INTO places (
      id, name, formatted_address, lat, lng, category, rating, google_place_id, website, phone_number, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, placeName, formattedAddress, lat, lng, category, rating, googlePlaceId, website, phoneNumber, notes]
  );

  const created = await db.queryOne<Place>('SELECT * FROM places WHERE id = ?', [id]);
  if (!created) {
    throw new Error(`Failed to insert or retrieve place "${placeName}" (${id})`);
  }

  return created;
}

/**
 * Validates whether a place is open on a given date and time.
 * If closed or outside operating hours, returns structured warning and open alternatives.
 */
export function validatePlaceOpeningHours(
  place: Place | CuratedPlace | { name: string; notes?: string | null; id?: string },
  dateStr: string,
  startTime?: string | null
): OpeningHoursValidationResult {
  // Look up schedule in Curated Catalog
  const curated = CURATED_POI_CATALOG.find(
    (c) => c.name.toLowerCase() === place.name.toLowerCase() || (place.id && c.id === place.id)
  );

  const schedule = curated?.opening_hours;
  if (!schedule) {
    return { isValid: true, open: true };
  }

  // Parse Date to day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dateObj = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00Z`);
  const dayOfWeek = dateObj.getUTCDay();
  const dayName = DAY_NAMES[dayOfWeek];

  const isOpenToday = schedule.open_days.includes(dayOfWeek);
  const openDayNames = schedule.open_days.map((d) => DAY_NAMES[d]);
  const hoursSummary = `${schedule.open_time} - ${schedule.close_time}`;

  // Find alternatives if closed
  const findAlternatives = (): Place[] => {
    return CURATED_POI_CATALOG.filter(
      (c) =>
        c.city === curated?.city &&
        c.name.toLowerCase() !== place.name.toLowerCase() &&
        c.opening_hours.open_days.includes(dayOfWeek)
    ).map((c) => ({
      id: c.id,
      name: c.name,
      formatted_address: c.formatted_address,
      lat: c.lat,
      lng: c.lng,
      category: c.category,
      rating: c.rating,
      google_place_id: c.google_place_id || null,
      website: c.website || null,
      phone_number: c.phone_number || null,
      notes: c.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  };

  if (!isOpenToday) {
    const alternatives = findAlternatives();
    return {
      isValid: false,
      open: false,
      warning: `${place.name} is scheduled on a ${dayName} (${dateStr}), but is closed on ${dayName}s.`,
      open_days: openDayNames,
      open_hours_summary: hoursSummary,
      suggested_alternatives: alternatives.slice(0, 3),
    };
  }

  // Check specific time if provided
  if (startTime) {
    let timeStr = startTime.trim();
    if (timeStr.includes('T')) {
      const parts = timeStr.split('T')[1];
      timeStr = parts.slice(0, 5);
    } else if (timeStr.length > 5) {
      timeStr = timeStr.slice(0, 5);
    }

    if (/^\d{2}:\d{2}$/.test(timeStr)) {
      if (timeStr < schedule.open_time || timeStr > schedule.close_time) {
        const alternatives = findAlternatives();
        return {
          isValid: false,
          open: false,
          warning: `${place.name} is scheduled at ${timeStr} on ${dayName}, but is closed at ${timeStr}. Regular hours are ${schedule.open_time} - ${schedule.close_time}.`,
          open_days: openDayNames,
          open_hours_summary: hoursSummary,
          suggested_alternatives: alternatives.slice(0, 3),
        };
      }
    }
  }

  return {
    isValid: true,
    open: true,
    open_days: openDayNames,
    open_hours_summary: hoursSummary,
  };
}
