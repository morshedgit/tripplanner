import type { DatabaseAdapter } from './client';

/**
 * Seeds a comprehensive, realistic 5-Day Kyoto trip into the database.
 * Used for local development, zero-config onboarding, and integration testing.
 */
export async function seedDefaultTrip(db: DatabaseAdapter): Promise<void> {
  const statements: { sql: string; params: any[] }[] = [];

  // 1. Trip
  statements.push({
    sql: `INSERT OR IGNORE INTO trips (
      id, title, destination, start_date, end_date, timezone, currency, budget_cap, cover_image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      'trip-kyoto-2026',
      '5-Day Kyoto Autumn Expedition',
      'Kyoto, Japan',
      '2026-11-01',
      '2026-11-05',
      'Asia/Tokyo',
      'USD',
      2500,
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e',
    ],
  });

  // 2. Collaborators
  statements.push(
    {
      sql: `INSERT OR IGNORE INTO collaborators (id, trip_id, name, email, avatar_url, role)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        'collab-alice',
        'trip-kyoto-2026',
        'Alice Chen',
        'alice@example.com',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
        'owner',
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO collaborators (id, trip_id, name, email, avatar_url, role)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        'collab-bob',
        'trip-kyoto-2026',
        'Bob Smith',
        'bob@example.com',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
        'editor',
      ],
    }
  );

  // 3. Calendar Days (5 Days)
  const daysData = [
    {
      id: 'day-1',
      num: 1,
      date: '2026-11-01',
      notes: 'Arrival in Kyoto, check into hotel, and explore Fushimi Inari evening paths.',
    },
    {
      id: 'day-2',
      num: 2,
      date: '2026-11-02',
      notes: 'Arashiyama bamboo forest morning walk and Tenryu-ji Zen temple gardens.',
    },
    {
      id: 'day-3',
      num: 3,
      date: '2026-11-03',
      notes: 'Central Kyoto food exploration at Nishiki Market and Gion stroll.',
    },
    {
      id: 'day-4',
      num: 4,
      date: '2026-11-04',
      notes: 'Historic Higashiyama walking path, Kiyomizu-dera, and autumn tea ceremony.',
    },
    {
      id: 'day-5',
      num: 5,
      date: '2026-11-05',
      notes: 'Kinkaku-ji (Golden Pavilion) morning reflection and souvenir packing.',
    },
  ];

  for (const day of daysData) {
    statements.push({
      sql: `INSERT OR IGNORE INTO days (id, trip_id, day_number, date, notes) VALUES (?, ?, ?, ?, ?)`,
      params: [day.id, 'trip-kyoto-2026', day.num, day.date, day.notes],
    });
  }

  // 4. Scheduled Sections (Morning, Afternoon, Evening for each day)
  const sectionTypes: ('morning' | 'afternoon' | 'evening')[] = ['morning', 'afternoon', 'evening'];
  for (const day of daysData) {
    for (let i = 0; i < sectionTypes.length; i++) {
      const type = sectionTypes[i];
      const title = type.charAt(0).toUpperCase() + type.slice(1);
      statements.push({
        sql: `INSERT OR IGNORE INTO sections (id, trip_id, day_id, title, section_type, sort_order)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [
          `sec-${day.id}-${type}`,
          'trip-kyoto-2026',
          day.id,
          title,
          type,
          i + 1,
        ],
      });
    }
  }

  // Unscheduled Wishlist Section
  statements.push({
    sql: `INSERT OR IGNORE INTO sections (id, trip_id, day_id, title, section_type, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)`,
    params: [
      'sec-wishlist',
      'trip-kyoto-2026',
      null,
      'Places to Visit',
      'wishlist',
      0,
    ],
  });

  // 5. Canonical Kyoto Places
  const placesData = [
    {
      id: 'place-fushimi',
      name: 'Fushimi Inari Taisha',
      address: '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto, 612-0882',
      lat: 34.9671,
      lng: 135.7727,
      category: 'attraction',
      rating: 4.8,
      google_place_id: 'ChIJm7_k3D8IAWARqBw5kFzVp2Q',
      website: 'http://inari.jp/',
      phone_number: '+81 75-641-7331',
      notes: 'Shinto shrine famous for its thousands of vermilion torii gates.',
    },
    {
      id: 'place-kinkaku',
      name: 'Kinkaku-ji (Golden Pavilion)',
      address: '1 Kinkakujicho, Kita Ward, Kyoto, 603-8361',
      lat: 35.0394,
      lng: 135.7292,
      category: 'attraction',
      rating: 4.7,
      google_place_id: 'ChIJ592tG24JAWAR7Vp4f6eG4k8',
      website: 'https://www.shokoku-ji.jp/kinkakuji/',
      phone_number: '+81 75-461-0013',
      notes: 'Zen Buddhist temple whose top two floors are completely covered in gold leaf.',
    },
    {
      id: 'place-arashiyama',
      name: 'Arashiyama Bamboo Grove',
      address: 'Sagatenryuji, Ukyo Ward, Kyoto, 616-8385',
      lat: 35.0169,
      lng: 135.6713,
      category: 'attraction',
      rating: 4.6,
      google_place_id: 'ChIJ9T6u5kL-AWARf7YvB0qBshE',
      website: null,
      phone_number: null,
      notes: 'Atmospheric path cutting through soaring natural bamboo stalks.',
    },
    {
      id: 'place-nishiki',
      name: 'Nishiki Market',
      address: 'Nakagyo Ward, Kyoto, 604-8055',
      lat: 35.0050,
      lng: 135.7649,
      category: 'shopping',
      rating: 4.4,
      google_place_id: 'ChIJFfL6m44IAWARiE_fJj1sY70',
      website: 'https://www.kyoto-nishiki.or.jp/',
      phone_number: '+81 75-211-3882',
      notes: 'Narrow 5-block shopping street known as "Kyoto\'s Kitchen".',
    },
    {
      id: 'place-kiyomizu',
      name: 'Kiyomizu-dera',
      address: '1 Chome-294 Kiyomizu, Higashiyama Ward, Kyoto, 605-0862',
      lat: 34.9949,
      lng: 135.7850,
      category: 'attraction',
      rating: 4.8,
      google_place_id: 'ChIJL-1b6oIIAWAR-8l9s0W6ZpA',
      website: 'https://www.kiyomizudera.or.jp/',
      phone_number: '+81 75-551-1234',
      notes: 'Historic temple perched on Mount Otowa with panoramic views of Kyoto.',
    },
    {
      id: 'place-tenryu',
      name: 'Tenryu-ji',
      address: '68 Sagatenryuji Susukinobabacho, Ukyo Ward, Kyoto, 616-8385',
      lat: 35.0158,
      lng: 135.6776,
      category: 'attraction',
      rating: 4.6,
      google_place_id: 'ChIJ81aJ-0D-AWARh_g7aC2YqE8',
      website: 'http://www.tenryuji.com/',
      phone_number: '+81 75-881-1235',
      notes: 'UNESCO World Heritage Zen temple with famous 14th-century pond garden.',
    },
    {
      id: 'place-ichiran',
      name: 'Ichiran Kyoto Kawaramachi',
      address: '598 Uraderacho, Nakagyo Ward, Kyoto, 604-8041',
      lat: 35.0042,
      lng: 135.7690,
      category: 'restaurant',
      rating: 4.5,
      google_place_id: 'ChIJh85Z_Y8IAWARG2hS1pQk0Bw',
      website: 'https://ichiran.com/',
      phone_number: '+81 75-241-2205',
      notes: 'Classic tonkotsu ramen served in private focus-flavor dining booths.',
    },
  ];

  for (const place of placesData) {
    statements.push({
      sql: `INSERT OR IGNORE INTO places (
        id, name, formatted_address, lat, lng, category, rating, google_place_id, website, phone_number, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        place.id,
        place.name,
        place.address,
        place.lat,
        place.lng,
        place.category,
        place.rating,
        place.google_place_id,
        place.website,
        place.phone_number,
        place.notes,
      ],
    });
  }

  // 6. Itinerary Stops
  const stopsData = [
    {
      id: 'stop-fushimi',
      section_id: 'sec-day-1-morning',
      place_id: 'place-fushimi',
      sort_order: 1,
      arrival_time: '09:00',
      departure_time: '11:30',
      duration_minutes: 150,
      user_notes: 'Start early to beat the tour buses. Hike up through the inner shrine.',
      budget_amount: 0,
    },
    {
      id: 'stop-ichiran-d1',
      section_id: 'sec-day-1-afternoon',
      place_id: 'place-ichiran',
      sort_order: 1,
      arrival_time: '12:30',
      departure_time: '13:30',
      duration_minutes: 60,
      user_notes: 'Lunch break for rich tonkotsu ramen.',
      budget_amount: 30,
    },
    {
      id: 'stop-arashiyama',
      section_id: 'sec-day-2-morning',
      place_id: 'place-arashiyama',
      sort_order: 1,
      arrival_time: '08:30',
      departure_time: '10:30',
      duration_minutes: 120,
      user_notes: 'Morning stroll through the bamboo grove.',
      budget_amount: 0,
    },
    {
      id: 'stop-tenryu',
      section_id: 'sec-day-2-afternoon',
      place_id: 'place-tenryu',
      sort_order: 1,
      arrival_time: '11:00',
      departure_time: '12:30',
      duration_minutes: 90,
      user_notes: 'Explore Sogenchi Garden and Dharma painting.',
      budget_amount: 10,
    },
    {
      id: 'stop-nishiki',
      section_id: 'sec-day-3-afternoon',
      place_id: 'place-nishiki',
      sort_order: 1,
      arrival_time: '12:00',
      departure_time: '14:30',
      duration_minutes: 150,
      user_notes: 'Street food tasting: takoyaki, tamagoyaki, and matcha dango.',
      budget_amount: 45,
    },
    {
      id: 'stop-kiyomizu',
      section_id: 'sec-day-4-morning',
      place_id: 'place-kiyomizu',
      sort_order: 1,
      arrival_time: '09:00',
      departure_time: '11:30',
      duration_minutes: 150,
      user_notes: 'Visit the main hall veranda and Otowa Waterfall.',
      budget_amount: 10,
    },
    {
      id: 'stop-kinkaku',
      section_id: 'sec-day-5-morning',
      place_id: 'place-kinkaku',
      sort_order: 1,
      arrival_time: '09:30',
      departure_time: '11:30',
      duration_minutes: 120,
      user_notes: 'Golden Pavilion view across the pond.',
      budget_amount: 10,
    },
  ];

  for (const stop of stopsData) {
    statements.push({
      sql: `INSERT OR IGNORE INTO stops (
        id, section_id, place_id, sort_order, arrival_time, departure_time, duration_minutes, user_notes, budget_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        stop.id,
        stop.section_id,
        stop.place_id,
        stop.sort_order,
        stop.arrival_time,
        stop.departure_time,
        stop.duration_minutes,
        stop.user_notes,
        stop.budget_amount,
      ],
    });
  }

  // 7. Transit Legs
  statements.push(
    {
      sql: `INSERT OR IGNORE INTO transit_legs (
        id, trip_id, from_stop_id, to_stop_id, transit_mode, duration_seconds, distance_meters, route_instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        'leg-d1-fushimi-ichiran',
        'trip-kyoto-2026',
        'stop-fushimi',
        'stop-ichiran-d1',
        'transit',
        1200,
        4500,
        'Take Keihan Main Line from Fushimi-Inari Station to Gion-Shijo Station (12 min), then 5 min walk west.',
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO transit_legs (
        id, trip_id, from_stop_id, to_stop_id, transit_mode, duration_seconds, distance_meters, route_instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        'leg-d2-arashiyama-tenryu',
        'trip-kyoto-2026',
        'stop-arashiyama',
        'stop-tenryu',
        'walking',
        300,
        350,
        'Walk south out of the Bamboo Grove entrance directly into the north gate of Tenryu-ji.',
      ],
    }
  );

  // 8. Reservations (Flight & Lodging)
  statements.push(
    {
      sql: `INSERT OR IGNORE INTO reservations (
        id, trip_id, type, title, confirmation_code, provider, start_time, end_time, location, cost, currency, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        'res-flight-ana',
        'trip-kyoto-2026',
        'flight',
        'ANA Flight NH 123 (HND -> ITM)',
        'NH-78291',
        'All Nippon Airways',
        '2026-11-01T08:00:00+09:00',
        '2026-11-01T09:15:00+09:00',
        'Haneda Airport (HND) to Itami Airport (ITM)',
        350,
        'USD',
        'Includes 2 checked baggage allowances per passenger.',
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO reservations (
        id, trip_id, type, title, confirmation_code, provider, start_time, end_time, location, cost, currency, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        'res-hotel-pocket',
        'trip-kyoto-2026',
        'lodging',
        'The Pocket Hotel Kyoto Karasuma',
        'PH-449102',
        'The Pocket Hotel',
        '2026-11-01T15:00:00+09:00',
        '2026-11-05T11:00:00+09:00',
        'Shimogyo Ward, Kyoto',
        600,
        'USD',
        'Compact private twin room, 4 nights total. Keyless smartphone entry.',
      ],
    }
  );

  // 9. Expenses and Splits
  statements.push(
    {
      sql: `INSERT OR IGNORE INTO expenses (
        id, trip_id, paid_by_collaborator_id, title, amount, currency, category, date, split_strategy, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        'exp-hotel',
        'trip-kyoto-2026',
        'collab-alice',
        'The Pocket Hotel 4 Nights',
        600.0,
        'USD',
        'lodging',
        '2026-11-01',
        'equal',
        'Total hotel accommodation for 4 nights.',
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO expense_splits (id, expense_id, collaborator_id, amount_owed, percentage, settled, settled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        'split-hotel-alice',
        'exp-hotel',
        'collab-alice',
        300.0,
        50.0,
        1,
        '2026-11-01T15:00:00Z',
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO expense_splits (id, expense_id, collaborator_id, amount_owed, percentage, settled, settled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        'split-hotel-bob',
        'exp-hotel',
        'collab-bob',
        300.0,
        50.0,
        0,
        null,
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO expenses (
        id, trip_id, paid_by_collaborator_id, title, amount, currency, category, date, split_strategy, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        'exp-shinkansen',
        'trip-kyoto-2026',
        'collab-bob',
        'Shinkansen Bullet Train Tickets',
        160.0,
        'USD',
        'transport',
        '2026-11-01',
        'equal',
        'Reserved seats on the Tokaido Shinkansen.',
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO expense_splits (id, expense_id, collaborator_id, amount_owed, percentage, settled, settled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        'split-train-alice',
        'exp-shinkansen',
        'collab-alice',
        80.0,
        50.0,
        0,
        null,
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO expense_splits (id, expense_id, collaborator_id, amount_owed, percentage, settled, settled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        'split-train-bob',
        'exp-shinkansen',
        'collab-bob',
        80.0,
        50.0,
        1,
        '2026-11-01T10:00:00Z',
      ],
    }
  );

  // 10. Checklists and Items
  statements.push(
    {
      sql: `INSERT OR IGNORE INTO checklists (id, trip_id, title, category, sort_order)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['chk-pre-trip', 'trip-kyoto-2026', 'Pre-trip Checklist', 'todo', 1],
    },
    {
      sql: `INSERT OR IGNORE INTO checklist_items (id, checklist_id, title, is_completed, assigned_to_collaborator_id, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: ['chki-jr-pass', 'chk-pre-trip', 'Book JR Rail Pass or Kansai Thru Pass', 1, null, 1],
    },
    {
      sql: `INSERT OR IGNORE INTO checklist_items (id, checklist_id, title, is_completed, assigned_to_collaborator_id, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: ['chki-esim', 'chk-pre-trip', 'Get Pocket Wi-Fi or Japan eSIM', 0, 'collab-bob', 2],
    },
    {
      sql: `INSERT OR IGNORE INTO checklist_items (id, checklist_id, title, is_completed, assigned_to_collaborator_id, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: ['chki-yen', 'chk-pre-trip', 'Exchange Yen or verify 7-Eleven ATM card', 0, 'collab-alice', 3],
    },
    {
      sql: `INSERT OR IGNORE INTO checklists (id, trip_id, title, category, sort_order)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['chk-packing', 'trip-kyoto-2026', 'Packing Essentials', 'packing', 2],
    },
    {
      sql: `INSERT OR IGNORE INTO checklist_items (id, checklist_id, title, is_completed, assigned_to_collaborator_id, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: ['chki-shoes', 'chk-packing', 'Comfortable walking / slip-on shoes for temples', 1, null, 1],
    },
    {
      sql: `INSERT OR IGNORE INTO checklist_items (id, checklist_id, title, is_completed, assigned_to_collaborator_id, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: ['chki-power', 'chk-packing', 'Universal power adapter (Type A)', 0, null, 2],
    }
  );

  // 11. Trip Notes
  statements.push({
    sql: `INSERT OR IGNORE INTO trip_notes (id, trip_id, title, content, updated_by_collaborator_id)
          VALUES (?, ?, ?, ?, ?)`,
    params: [
      'note-kyoto-tips',
      'trip-kyoto-2026',
      'Kyoto Travel Tips & Etiquette',
      '1. IC Cards: Use Suica / Pasmo / ICOCA for all subway and city bus lines.\n' +
        '2. Temple etiquette: Remove shoes when entering temple halls and turn off camera flash.\n' +
        '3. Bus etiquette: Board at the rear, exit at the front, and pay exact fare upon exit.\n' +
        '4. Autumn foliage: Peak momiji colors occur around mid-to-late November in Arashiyama and Higashiyama.',
      'collab-alice',
    ],
  });

  // 12. Stop Votes
  statements.push(
    {
      sql: `INSERT OR IGNORE INTO stop_votes (id, stop_id, collaborator_id, vote_type)
            VALUES (?, ?, ?, ?)`,
      params: ['vote-alice-fushimi', 'stop-fushimi', 'collab-alice', 'up'],
    },
    {
      sql: `INSERT OR IGNORE INTO stop_votes (id, stop_id, collaborator_id, vote_type)
            VALUES (?, ?, ?, ?)`,
      params: ['vote-bob-fushimi', 'stop-fushimi', 'collab-bob', 'up'],
    },
    {
      sql: `INSERT OR IGNORE INTO stop_votes (id, stop_id, collaborator_id, vote_type)
            VALUES (?, ?, ?, ?)`,
      params: ['vote-bob-arashiyama', 'stop-arashiyama', 'collab-bob', 'up'],
    }
  );

  await db.batch(statements);
}
