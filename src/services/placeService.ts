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

  // --- ITALY (ROME, FLORENCE, TUSCANY, VENICE) ---
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
    notes: 'Ancient Roman Flavian Amphitheatre and premier landmark of Imperial Rome.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '08:30',
      close_time: '19:00',
      notes: 'Open daily 8:30 AM - 7:00 PM',
    },
    tags: ['ancient', 'amphitheatre', 'history', 'unesco', 'rome', 'italy'],
  },
  {
    id: 'place-roman-forum',
    name: 'Roman Forum & Palatine Hill',
    formatted_address: 'Via della Salara Vecchia, 5/6, 00186 Roma RM, Italy',
    city: 'Rome',
    country: 'Italy',
    lat: 41.8925,
    lng: 12.4853,
    category: 'attraction',
    rating: 4.8,
    price_level: 2,
    google_place_id: 'ChIJbf8C1yF5LxMRs9mU3T0nK7A',
    website: 'https://parcocolosseo.it/',
    phone_number: '+39 06 3996 7700',
    notes: 'Heart of ancient Roman public life, temples, basilicas, and imperial palaces.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '09:00',
      close_time: '19:00',
      notes: 'Open daily 9:00 AM - 7:00 PM',
    },
    tags: ['ruins', 'ancient', 'imperial', 'palatine', 'rome', 'italy'],
  },
  {
    id: 'place-pantheon',
    name: 'Pantheon',
    formatted_address: 'Piazza della Rotonda, 00186 Roma RM, Italy',
    city: 'Rome',
    country: 'Italy',
    lat: 41.8986,
    lng: 12.4769,
    category: 'attraction',
    rating: 4.8,
    price_level: 1,
    google_place_id: 'ChIJqUCGZ09gLxMRLM42IPpl0co',
    website: 'https://www.pantheonroma.com/',
    phone_number: '+39 06 6830 0230',
    notes: 'Best-preserved ancient Roman monument featuring the world\'s largest unreinforced concrete dome and oculus.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '09:00',
      close_time: '19:00',
      notes: 'Open daily 9:00 AM - 7:00 PM',
    },
    tags: ['temple', 'dome', 'architecture', 'raphael', 'rome', 'italy'],
  },
  {
    id: 'place-trevi-fountain',
    name: 'Trevi Fountain',
    formatted_address: 'Piazza di Trevi, 00187 Roma RM, Italy',
    city: 'Rome',
    country: 'Italy',
    lat: 41.9009,
    lng: 12.4833,
    category: 'attraction',
    rating: 4.8,
    price_level: 1,
    google_place_id: 'ChIJ1UCDJ1NgLxMRtrs2OHxdv2A',
    website: null,
    phone_number: null,
    notes: 'Iconic 18th-century Baroque travertine fountain designed by Nicola Salvi.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '00:00',
      close_time: '23:59',
      notes: 'Open 24 hours daily',
    },
    tags: ['fountain', 'baroque', 'landmark', 'evening', 'rome', 'italy'],
  },
  {
    id: 'place-piazza-navona',
    name: 'Piazza Navona',
    formatted_address: 'Piazza Navona, 00186 Roma RM, Italy',
    city: 'Rome',
    country: 'Italy',
    lat: 41.8992,
    lng: 12.4731,
    category: 'attraction',
    rating: 4.7,
    price_level: 1,
    google_place_id: 'ChIJh9k3U05gLxMRxK5n1M0mP40',
    website: null,
    phone_number: null,
    notes: 'Elegant Baroque public square built on the site of the Stadium of Domitian, featuring Bernini\'s Fountain of the Four Rivers.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '00:00',
      close_time: '23:59',
      notes: 'Open 24 hours daily',
    },
    tags: ['piazza', 'bernini', 'baroque', 'cafes', 'rome', 'italy'],
  },
  {
    id: 'place-vatican',
    name: 'Vatican Museums',
    formatted_address: 'Viale Vaticano, 00165 Roma RM, Italy (Vatican City)',
    city: 'Rome',
    country: 'Italy',
    lat: 41.9067,
    lng: 12.4534,
    category: 'attraction',
    rating: 4.7,
    price_level: 3,
    google_place_id: 'ChIJz2x_v1RhLxMRvP0uO8V1A10',
    website: 'https://www.museivaticani.va/',
    phone_number: '+39 06 6988 4676',
    notes: 'Christian and art museums housing the Raphael Rooms and Michelangelo\'s Sistine Chapel. Closed on Sundays.',
    opening_hours: {
      open_days: [1, 2, 3, 4, 5, 6], // Closed Sunday (0)
      open_time: '08:00',
      close_time: '19:00',
      notes: 'Closed on Sundays. Open Mon-Sat 8:00 AM - 7:00 PM',
    },
    tags: ['vatican', 'art', 'sistine chapel', 'museum', 'rome', 'italy'],
  },
  {
    id: 'place-st-peters-basilica',
    name: "St. Peter's Basilica",
    formatted_address: 'Piazza San Pietro, 00120 Città del Vaticano, Rome, Italy',
    city: 'Rome',
    country: 'Italy',
    lat: 41.9022,
    lng: 12.4539,
    category: 'attraction',
    rating: 4.9,
    price_level: 1,
    google_place_id: 'ChIJv7YPd1dhLxMRf3R6w1q5R2k',
    website: 'https://www.basilicasanpietro.va/',
    phone_number: '+39 06 6982',
    notes: 'Renaissance masterpiece designed by Bramante, Michelangelo, and Bernini, housing La Pietà.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '07:00',
      close_time: '19:10',
      notes: 'Open daily 7:00 AM - 7:10 PM',
    },
    tags: ['basilica', 'vatican', 'michelangelo', 'dome', 'rome', 'italy'],
  },
  {
    id: 'place-castel-sant-angelo',
    name: "Castel Sant'Angelo",
    formatted_address: 'Lungotevere Castello, 50, 00193 Roma RM, Italy',
    city: 'Rome',
    country: 'Italy',
    lat: 41.9031,
    lng: 12.4663,
    category: 'attraction',
    rating: 4.7,
    price_level: 2,
    google_place_id: 'ChIJc61tNldhLxMRs6G1u7p8K0w',
    website: 'http://castelsantangelo.beniculturali.it/',
    phone_number: '+39 06 681 9111',
    notes: 'Cylindrical fortress and Mausoleum of Hadrian overlooking the Tiber River and Ponte Sant\'Angelo.',
    opening_hours: {
      open_days: [0, 2, 3, 4, 5, 6], // Closed Monday (1)
      open_time: '09:00',
      close_time: '19:30',
      notes: 'Closed on Mondays. Open Tue-Sun 9:00 AM - 7:30 PM',
    },
    tags: ['castle', 'fortress', 'tiber', 'history', 'rome', 'italy'],
  },
  {
    id: 'place-galleria-borghese',
    name: 'Galleria Borghese',
    formatted_address: 'Piazzale Scipione Borghese, 5, 00197 Roma RM, Italy',
    city: 'Rome',
    country: 'Italy',
    lat: 41.9142,
    lng: 12.4921,
    category: 'attraction',
    rating: 4.8,
    price_level: 3,
    google_place_id: 'ChIJP_t3xG9gLxMRp8m4R0n9T1w',
    website: 'https://galleriaborghese.beniculturali.it/',
    phone_number: '+39 06 841 3979',
    notes: 'Villa museum set in Villa Borghese gardens housing renowned sculptures by Bernini and paintings by Caravaggio.',
    opening_hours: {
      open_days: [0, 2, 3, 4, 5, 6], // Closed Monday (1)
      open_time: '09:00',
      close_time: '19:00',
      notes: 'Closed on Mondays. Timed entry required Tue-Sun 9:00 AM - 7:00 PM',
    },
    tags: ['gallery', 'bernini', 'caravaggio', 'art', 'rome', 'italy'],
  },
  {
    id: 'place-trastevere',
    name: 'Trastevere & Piazza di Santa Maria',
    formatted_address: 'Piazza di Santa Maria in Trastevere, 00153 Roma RM, Italy',
    city: 'Rome',
    country: 'Italy',
    lat: 41.8894,
    lng: 12.4705,
    category: 'restaurant',
    rating: 4.8,
    price_level: 2,
    google_place_id: 'ChIJw7x9L0RgLxMRy4N2m1k8P0c',
    website: null,
    phone_number: null,
    notes: 'Bohemian neighborhood across the Tiber famed for cobblestone trattorias, cacio e pepe, carbonara, and historic mosaics.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '00:00',
      close_time: '23:59',
      notes: 'Open 24 hours daily',
    },
    tags: ['trattoria', 'pasta', 'dining', 'nightlife', 'trastevere', 'rome', 'italy'],
  },
  {
    id: 'place-florence-duomo',
    name: 'Cathedral of Santa Maria del Fiore (Duomo)',
    formatted_address: 'Piazza del Duomo, 50122 Firenze FI, Italy',
    city: 'Florence',
    country: 'Italy',
    lat: 43.7731,
    lng: 11.256,
    category: 'attraction',
    rating: 4.9,
    price_level: 2,
    google_place_id: 'ChIJdd4hrwugKhMRLM42IPpl0co',
    website: 'https://duomo.firenze.it/',
    phone_number: '+39 055 230 2885',
    notes: 'Iconic Gothic and Renaissance cathedral crowned by Filippo Brunelleschi\'s terracotta brick dome.',
    opening_hours: {
      open_days: [1, 2, 3, 4, 5, 6],
      open_time: '10:15',
      close_time: '16:45',
      notes: 'Cathedral open Mon-Sat 10:15 AM - 4:45 PM; Brunelleschi Dome open daily with reservation',
    },
    tags: ['duomo', 'cathedral', 'brunelleschi', 'renaissance', 'florence', 'tuscany', 'italy'],
  },
  {
    id: 'place-uffizi-gallery',
    name: 'Uffizi Gallery',
    formatted_address: 'Piazzale degli Uffizi, 6, 50122 Firenze FI, Italy',
    city: 'Florence',
    country: 'Italy',
    lat: 43.7678,
    lng: 11.2553,
    category: 'attraction',
    rating: 4.8,
    price_level: 3,
    google_place_id: 'ChIJw7x9L0RgKhMRy4N2m1k8P0c',
    website: 'https://www.uffizi.it/',
    phone_number: '+39 055 294883',
    notes: 'World-renowned art museum housing masterpieces by Botticelli (Birth of Venus), Leonardo da Vinci, and Michelangelo. Closed Mondays.',
    opening_hours: {
      open_days: [0, 2, 3, 4, 5, 6], // Closed Monday (1)
      open_time: '08:15',
      close_time: '18:30',
      notes: 'Closed on Mondays. Open Tue-Sun 8:15 AM - 6:30 PM',
    },
    tags: ['museum', 'botticelli', 'renaissance', 'art', 'florence', 'tuscany', 'italy'],
  },
  {
    id: 'place-accademia-gallery',
    name: "Galleria dell'Accademia (Michelangelo's David)",
    formatted_address: 'Via Ricasoli, 58/60, 50129 Firenze FI, Italy',
    city: 'Florence',
    country: 'Italy',
    lat: 43.7768,
    lng: 11.2586,
    category: 'attraction',
    rating: 4.8,
    price_level: 2,
    google_place_id: 'ChIJ592tG24JKhMR7Vp4f6eG4k8',
    website: 'https://www.galleriaaccademiafirenze.it/',
    phone_number: '+39 055 098 7100',
    notes: 'Home to Michelangelo\'s original 17-foot marble sculpture of David and Renaissance paintings. Closed Mondays.',
    opening_hours: {
      open_days: [0, 2, 3, 4, 5, 6], // Closed Monday (1)
      open_time: '08:15',
      close_time: '18:50',
      notes: 'Closed on Mondays. Open Tue-Sun 8:15 AM - 6:50 PM',
    },
    tags: ['david', 'michelangelo', 'sculpture', 'museum', 'florence', 'tuscany', 'italy'],
  },
  {
    id: 'place-ponte-vecchio',
    name: 'Ponte Vecchio',
    formatted_address: 'Ponte Vecchio, 50125 Firenze FI, Italy',
    city: 'Florence',
    country: 'Italy',
    lat: 43.768,
    lng: 11.2531,
    category: 'attraction',
    rating: 4.8,
    price_level: 1,
    google_place_id: 'ChIJL-1b6oIIKhMR-8l9s0W6ZpA',
    website: null,
    phone_number: null,
    notes: 'Medieval stone arch bridge over the Arno River lined with historic goldsmith and jewelry shops.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '00:00',
      close_time: '23:59',
      notes: 'Bridge open 24 hours daily; shops open 10:00 AM - 7:00 PM',
    },
    tags: ['bridge', 'arno', 'sunset', 'landmark', 'florence', 'tuscany', 'italy'],
  },
  {
    id: 'place-piazzale-michelangelo',
    name: 'Piazzale Michelangelo',
    formatted_address: 'Piazzale Michelangelo, 50125 Firenze FI, Italy',
    city: 'Florence',
    country: 'Italy',
    lat: 43.7629,
    lng: 11.2651,
    category: 'attraction',
    rating: 4.9,
    price_level: 1,
    google_place_id: 'ChIJ9T6u5kL-KhMRf7YvB0qBshE',
    website: null,
    phone_number: null,
    notes: 'Hilltop square offering sweeping panoramic views of Florence\'s skyline, Duomo, and Arno bridges at sunset.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '00:00',
      close_time: '23:59',
      notes: 'Open 24 hours daily',
    },
    tags: ['viewpoint', 'sunset', 'skyline', 'panorama', 'florence', 'tuscany', 'italy'],
  },
  {
    id: 'place-mercato-centrale-firenze',
    name: 'Mercato Centrale Firenze',
    formatted_address: 'Piazza del Mercato Centrale, Via dell\'Ariento, 50123 Firenze FI, Italy',
    city: 'Florence',
    country: 'Italy',
    lat: 43.7764,
    lng: 11.2535,
    category: 'restaurant',
    rating: 4.6,
    price_level: 2,
    google_place_id: 'ChIJFfL6m44IKhMRiE_fJj1sY70',
    website: 'https://www.mercatocentrale.it/firenze/',
    phone_number: '+39 055 239 9798',
    notes: 'Bustling 19th-century cast-iron food hall offering Tuscan truffles, bistecca alla fiorentina, fresh pasta, and Chianti wine.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '09:00',
      close_time: '23:00',
      notes: 'Open daily 9:00 AM - 11:00 PM',
    },
    tags: ['market', 'food hall', 'bistecca', 'tuscan food', 'florence', 'tuscany', 'italy'],
  },
  {
    id: 'place-palazzo-pitti-boboli',
    name: 'Palazzo Pitti & Boboli Gardens',
    formatted_address: 'Piazza de\' Pitti, 1, 50125 Firenze FI, Italy',
    city: 'Florence',
    country: 'Italy',
    lat: 43.7652,
    lng: 11.25,
    category: 'attraction',
    rating: 4.7,
    price_level: 2,
    google_place_id: 'ChIJn0fCgEwIKhMRbA-p4c1XQ8c',
    website: 'https://www.uffizi.it/palazzo-pitti-giardino-boboli',
    phone_number: '+39 055 294883',
    notes: 'Grand Renaissance Medici palace and monumental Italianate sculpture gardens across the Arno.',
    opening_hours: {
      open_days: [0, 2, 3, 4, 5, 6], // Closed Monday (1)
      open_time: '08:15',
      close_time: '18:30',
      notes: 'Palace closed Mondays; Boboli Gardens open daily 8:15 AM - 6:30 PM',
    },
    tags: ['palace', 'gardens', 'medici', 'renaissance', 'florence', 'tuscany', 'italy'],
  },
  {
    id: 'place-siena-piazza-del-campo',
    name: 'Piazza del Campo (Siena)',
    formatted_address: 'Piazza del Campo, 53100 Siena SI, Tuscany, Italy',
    city: 'Siena',
    country: 'Italy',
    lat: 43.3185,
    lng: 11.3316,
    category: 'attraction',
    rating: 4.9,
    price_level: 1,
    google_place_id: 'ChIJ2ZtEzoMIKhMRpQfE6r7fJ34',
    website: null,
    phone_number: null,
    notes: 'Medieval shell-shaped brick square in the heart of Siena, famous for the Palio horse race and Torre del Mangia.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '00:00',
      close_time: '23:59',
      notes: 'Open 24 hours daily',
    },
    tags: ['siena', 'tuscany', 'medieval', 'piazza', 'unesco', 'florence', 'italy'],
  },
  {
    id: 'place-leaning-tower-pisa',
    name: 'Leaning Tower of Pisa',
    formatted_address: 'Piazza del Duomo, 56126 Pisa PI, Tuscany, Italy',
    city: 'Pisa',
    country: 'Italy',
    lat: 43.723,
    lng: 10.3966,
    category: 'attraction',
    rating: 4.7,
    price_level: 2,
    google_place_id: 'ChIJh85Z_Y8IKhMRG2hS1pQk0Bw',
    website: 'https://www.opapisa.it/',
    phone_number: '+39 050 835011',
    notes: 'Freestanding Romanesque bell tower of Pisa Cathedral renowned worldwide for its 4-degree tilt.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '09:00',
      close_time: '20:00',
      notes: 'Open daily 9:00 AM - 8:00 PM',
    },
    tags: ['pisa', 'tuscany', 'tower', 'landmark', 'unesco', 'florence', 'italy'],
  },
  {
    id: 'place-st-marks-basilica',
    name: "St. Mark's Basilica (Basilica di San Marco)",
    formatted_address: 'Piazza San Marco, 328, 30100 Venezia VE, Italy',
    city: 'Venice',
    country: 'Italy',
    lat: 45.4346,
    lng: 12.3397,
    category: 'attraction',
    rating: 4.8,
    price_level: 2,
    google_place_id: 'ChIJO5Q9q48IeUcR9-lX3KfZK20',
    website: 'https://www.basilicasanmarco.it/',
    phone_number: '+39 041 270 8311',
    notes: 'Italo-Byzantine cathedral on Piazza San Marco famous for its opulent golden mosaics and Pala d\'Oro.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '09:30',
      close_time: '17:15',
      notes: 'Open Mon-Sat 9:30 AM - 5:15 PM, Sun 2:00 PM - 5:15 PM',
    },
    tags: ['basilica', 'san marco', 'byzantine', 'mosaics', 'venice', 'italy'],
  },
  {
    id: 'place-doges-palace',
    name: "Doge's Palace (Palazzo Ducale)",
    formatted_address: 'Piazza San Marco, 1, 30124 Venezia VE, Italy',
    city: 'Venice',
    country: 'Italy',
    lat: 45.4337,
    lng: 12.3404,
    category: 'attraction',
    rating: 4.8,
    price_level: 3,
    google_place_id: 'ChIJX9zB4mCLeUcRL5R7Z0_c8tM',
    website: 'https://palazzoducale.visitmuve.it/',
    phone_number: '+39 041 271 5911',
    notes: 'Venetian Gothic palace that served as the residence of the Doge of Venice and connects to the Bridge of Sighs.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '09:00',
      close_time: '19:00',
      notes: 'Open daily 9:00 AM - 7:00 PM',
    },
    tags: ['palace', 'gothic', 'bridge of sighs', 'san marco', 'venice', 'italy'],
  },
  {
    id: 'place-rialto-bridge',
    name: 'Rialto Bridge & Grand Canal',
    formatted_address: 'Sestiere San Polo, 30125 Venezia VE, Italy',
    city: 'Venice',
    country: 'Italy',
    lat: 45.438,
    lng: 12.3359,
    category: 'attraction',
    rating: 4.8,
    price_level: 1,
    google_place_id: 'ChIJj62QWqmLeUcR_ErQDfW64tA',
    website: null,
    phone_number: null,
    notes: 'Oldest and most famous Renaissance stone arch bridge spanning the Grand Canal in Venice.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '00:00',
      close_time: '23:59',
      notes: 'Open 24 hours daily',
    },
    tags: ['bridge', 'grand canal', 'gondola', 'rialto', 'venice', 'italy'],
  },
  {
    id: 'place-burano-murano',
    name: 'Burano & Murano Islands',
    formatted_address: 'Laguna di Venezia, 30142 Venezia VE, Italy',
    city: 'Venice',
    country: 'Italy',
    lat: 45.4854,
    lng: 12.4167,
    category: 'attraction',
    rating: 4.8,
    price_level: 1,
    google_place_id: 'ChIJV4A5k_SLeUcRV3-wJ0e_uQI',
    website: null,
    phone_number: null,
    notes: 'Venetian Lagoon islands celebrated for Murano glassblowing workshops and Burano\'s brightly painted fishermen houses and lace.',
    opening_hours: {
      open_days: [0, 1, 2, 3, 4, 5, 6],
      open_time: '08:00',
      close_time: '20:00',
      notes: 'Vaporetto ferry access daily',
    },
    tags: ['islands', 'lagoon', 'glass', 'colorful', 'burano', 'murano', 'venice', 'italy'],
  },
  {
    id: 'place-peggy-guggenheim',
    name: 'Peggy Guggenheim Collection',
    formatted_address: 'Dorsoduro, 701-704, 30123 Venezia VE, Italy',
    city: 'Venice',
    country: 'Italy',
    lat: 45.4309,
    lng: 12.3315,
    category: 'attraction',
    rating: 4.7,
    price_level: 2,
    google_place_id: 'ChIJ57E_mJCLeUcRXo5g_x2x140',
    website: 'https://www.guggenheim-venice.it/',
    phone_number: '+39 041 240 5411',
    notes: 'Modern art museum on the Grand Canal in Palazzo Venier dei Leoni. Closed on Tuesdays.',
    opening_hours: {
      open_days: [0, 1, 3, 4, 5, 6], // Closed Tuesday (2)
      open_time: '10:00',
      close_time: '18:00',
      notes: 'Closed on Tuesdays. Open Wed-Mon 10:00 AM - 6:00 PM',
    },
    tags: ['museum', 'modern art', 'dorsoduro', 'grand canal', 'venice', 'italy'],
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
    if (
      trimmedCity &&
      item.city.toLowerCase() !== trimmedCity &&
      item.country.toLowerCase() !== trimmedCity &&
      !item.formatted_address.toLowerCase().includes(trimmedCity) &&
      !item.tags?.some((t) => t.toLowerCase() === trimmedCity)
    ) {
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
    const lowerName = name.trim().toLowerCase();
    candidate =
      CURATED_POI_CATALOG.find((c) => c.name.toLowerCase() === lowerName) ||
      CURATED_POI_CATALOG.find(
        (c) =>
          c.name.toLowerCase().includes(lowerName) ||
          lowerName.includes(c.name.toLowerCase())
      );
  }

  if (candidate?.id) {
    const existingById = await db.queryOne<Place>('SELECT * FROM places WHERE id = ?', [candidate.id]);
    if (existingById) return existingById;
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
    `INSERT OR IGNORE INTO places (
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
