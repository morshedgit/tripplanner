/**
 * Curated high-resolution Unsplash imagery for TripPlanner destinations, POIs, and categories.
 * Provides fallback imagery for 2026 Spatial Travel Workspace.
 */

// Destination Hero Covers (1600px width)
export const DESTINATION_COVERS: Record<string, string> = {
  rome: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=80',
  florence: 'https://images.unsplash.com/photo-1543429776-2782fc8e1acd?auto=format&fit=crop&w=1600&q=80',
  tuscany: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1600&q=80',
  venice: 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?auto=format&fit=crop&w=1600&q=80',
  kyoto: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=80',
  tokyo: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=80',
  paris: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=80',
  'new york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1600&q=80',
  london: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1600&q=80',
  wanderlust: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80',
};

// Italian POIs (600px width)
const ITALIAN_POIS: Record<string, string> = {
  colosseum: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=600&q=80',
  'roman forum': 'https://images.unsplash.com/photo-1542820229-081e0c12af0b?auto=format&fit=crop&w=600&q=80',
  pantheon: 'https://images.unsplash.com/photo-1583488806282-e0344d2d4f8f?auto=format&fit=crop&w=600&q=80',
  'trevi fountain': 'https://images.unsplash.com/photo-1525874684015-58379d421a52?auto=format&fit=crop&w=600&q=80',
  'piazza navona': 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=600&q=80',
  vatican: 'https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=600&q=80',
  "st. peter's": 'https://images.unsplash.com/photo-1576085898323-218337e3e43c?auto=format&fit=crop&w=600&q=80',
  "castel sant'angelo": 'https://images.unsplash.com/photo-1543429776-2782fc8e1acd?auto=format&fit=crop&w=600&q=80',
  'galleria borghese': 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
  trastevere: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
  'duomo firenze': 'https://images.unsplash.com/photo-1543429776-2782fc8e1acd?auto=format&fit=crop&w=600&q=80',
  uffizi: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
  'accademia david': 'https://images.unsplash.com/photo-1579783901586-7880cb249740?auto=format&fit=crop&w=600&q=80',
  'ponte vecchio': 'https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=600&q=80',
  'piazzale michelangelo': 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=600&q=80',
  'mercato centrale': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
  'palazzo pitti': 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=600&q=80',
  siena: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
  pisa: 'https://images.unsplash.com/photo-1548625361-168a2bf10903?auto=format&fit=crop&w=600&q=80',
  "st. mark's": 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?auto=format&fit=crop&w=600&q=80',
  "doge's palace": 'https://images.unsplash.com/photo-1520175480921-4edfa2983e0f?auto=format&fit=crop&w=600&q=80',
  'rialto bridge': 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?auto=format&fit=crop&w=600&q=80',
  'burano & murano': 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=600&q=80',
  'peggy guggenheim': 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
  "villa d'este": 'https://images.unsplash.com/photo-1584467735815-f778f274e296?auto=format&fit=crop&w=600&q=80',
  'santa maria novella': 'https://images.unsplash.com/photo-1543429776-2782fc8e1acd?auto=format&fit=crop&w=600&q=80',
  'libreria acqua alta': 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
};

// Kyoto / Japan POIs (600px width)
const JAPAN_POIS: Record<string, string> = {
  'fushimi inari': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',
  'kinkaku-ji': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80',
  'kiyomizu-dera': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',
  arashiyama: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80',
  'tenryu-ji': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',
  'nishiki market': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
  'nijo castle': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80',
  gion: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',
  ichiran: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
};

// Categorical Fallbacks
export const CATEGORY_FALLBACKS: Record<string, string> = {
  attraction: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
  sight: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
  museum: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=600&q=80',
  culture: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=600&q=80',
  restaurant: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
  dining: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
  food: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
  cafe: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
  lodging: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80',
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80',
  transit: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
  transport: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
  train: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
  flight: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80',
  activity: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
  shopping: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=600&q=80',
  nature: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80',
  park: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80',
};

/**
 * Returns a high-resolution hero cover image URL for a destination.
 * If customUrl is provided, it is returned.
 */
export function getDestinationCoverUrl(destination: string, customUrl?: string | null): string {
  if (customUrl && customUrl.trim().length > 0) {
    return customUrl.trim();
  }

  const dest = (destination || '').toLowerCase().trim();

  if (dest.includes('rome') || dest.includes('roma') || dest.includes('vatican') || dest.includes('lazio')) {
    return DESTINATION_COVERS.rome;
  }
  if (dest.includes('florence') || dest.includes('firenze')) {
    return DESTINATION_COVERS.florence;
  }
  if (dest.includes('tuscany') || dest.includes('toscana') || dest.includes('siena') || dest.includes('pisa') || dest.includes('chianti')) {
    return DESTINATION_COVERS.tuscany;
  }
  if (dest.includes('venice') || dest.includes('venezia') || dest.includes('veneto')) {
    return DESTINATION_COVERS.venice;
  }
  if (dest.includes('kyoto') || dest.includes('kansai')) {
    return DESTINATION_COVERS.kyoto;
  }
  if (dest.includes('tokyo') || dest.includes('kanto')) {
    return DESTINATION_COVERS.tokyo;
  }
  if (dest.includes('paris') || dest.includes('france')) {
    return DESTINATION_COVERS.paris;
  }
  if (dest.includes('new york') || dest.includes('nyc') || dest.includes('manhattan')) {
    return DESTINATION_COVERS['new york'];
  }
  if (dest.includes('london') || dest.includes('uk') || dest.includes('england')) {
    return DESTINATION_COVERS.london;
  }

  return DESTINATION_COVERS.wanderlust;
}

/**
 * Resolves a curated high-resolution thumbnail photo for a place name,
 * matching Italian POIs, Kyoto/Japan POIs, or falling back to category/wanderlust imagery.
 */
export function getPlaceImageUrl(placeName: string, category?: string, destination?: string): string {
  const name = (placeName || '').toLowerCase().trim();

  // 1. Italian POIs matching
  if (name.includes('colosseum') || name.includes('colosseo')) return ITALIAN_POIS.colosseum;
  if (name.includes('roman forum') || name.includes('foro romano')) return ITALIAN_POIS['roman forum'];
  if (name.includes('pantheon')) return ITALIAN_POIS.pantheon;
  if (name.includes('trevi')) return ITALIAN_POIS['trevi fountain'];
  if (name.includes('piazza navona') || name.includes('navona')) return ITALIAN_POIS['piazza navona'];
  if (name.includes('vatican') || name.includes('sistine') || name.includes('basilica di san pietro')) return ITALIAN_POIS.vatican;
  if (name.includes("st. peter") || name.includes('saint peter') || name.includes('san pietro')) return ITALIAN_POIS["st. peter's"];
  if (name.includes("sant'angelo") || name.includes('sant angelo') || name.includes('castel')) return ITALIAN_POIS["castel sant'angelo"];
  if (name.includes('borghese')) return ITALIAN_POIS['galleria borghese'];
  if (name.includes('trastevere')) return ITALIAN_POIS.trastevere;
  if (name.includes('duomo') && (name.includes('firenze') || name.includes('florence') || (destination || '').toLowerCase().includes('florence'))) {
    return ITALIAN_POIS['duomo firenze'];
  }
  if (name.includes('uffizi')) return ITALIAN_POIS.uffizi;
  if (name.includes('accademia') || name.includes('david')) return ITALIAN_POIS['accademia david'];
  if (name.includes('ponte vecchio')) return ITALIAN_POIS['ponte vecchio'];
  if (name.includes('piazzale michelangelo') || name.includes('michelangelo')) return ITALIAN_POIS['piazzale michelangelo'];
  if (name.includes('mercato centrale')) return ITALIAN_POIS['mercato centrale'];
  if (name.includes('palazzo pitti') || name.includes('pitti') || name.includes('boboli')) return ITALIAN_POIS['palazzo pitti'];
  if (name.includes('siena') || name.includes('piazza del campo')) return ITALIAN_POIS.siena;
  if (name.includes('pisa') || name.includes('leaning tower')) return ITALIAN_POIS.pisa;
  if (name.includes("st. mark") || name.includes('san marco') || name.includes('saint mark')) return ITALIAN_POIS["st. mark's"];
  if (name.includes("doge's") || name.includes('doge') || name.includes('palazzo ducale')) return ITALIAN_POIS["doge's palace"];
  if (name.includes('rialto')) return ITALIAN_POIS['rialto bridge'];
  if (name.includes('burano') || name.includes('murano')) return ITALIAN_POIS['burano & murano'];
  if (name.includes('guggenheim')) return ITALIAN_POIS['peggy guggenheim'];
  if (name.includes("villa d'este") || name.includes('tivoli')) return ITALIAN_POIS["villa d'este"];
  if (name.includes('santa maria novella') || name.includes('novella')) return ITALIAN_POIS['santa maria novella'];
  if (name.includes('libreria acqua alta') || name.includes('acqua alta')) return ITALIAN_POIS['libreria acqua alta'];

  // 2. Kyoto / Japan POIs matching
  if (name.includes('fushimi') || name.includes('inari')) return JAPAN_POIS['fushimi inari'];
  if (name.includes('kinkaku') || name.includes('golden pavilion')) return JAPAN_POIS['kinkaku-ji'];
  if (name.includes('kiyomizu')) return JAPAN_POIS['kiyomizu-dera'];
  if (name.includes('arashiyama') || name.includes('bamboo')) return JAPAN_POIS.arashiyama;
  if (name.includes('tenryu')) return JAPAN_POIS['tenryu-ji'];
  if (name.includes('nishiki')) return JAPAN_POIS['nishiki market'];
  if (name.includes('nijo')) return JAPAN_POIS['nijo castle'];
  if (name.includes('gion') || name.includes('yasaka')) return JAPAN_POIS.gion;
  if (name.includes('ichiran') || name.includes('ramen')) return JAPAN_POIS.ichiran;

  // 3. Category Fallbacks
  const cat = (category || '').toLowerCase().trim();
  if (cat && CATEGORY_FALLBACKS[cat]) {
    return CATEGORY_FALLBACKS[cat];
  }
  if (cat.includes('food') || cat.includes('eat') || cat.includes('dine') || cat.includes('restaur')) {
    return CATEGORY_FALLBACKS.restaurant;
  }
  if (cat.includes('hotel') || cat.includes('lodg') || cat.includes('stay') || cat.includes('resort')) {
    return CATEGORY_FALLBACKS.lodging;
  }
  if (cat.includes('transit') || cat.includes('flight') || cat.includes('train') || cat.includes('rail')) {
    return CATEGORY_FALLBACKS.transit;
  }
  if (cat.includes('museum') || cat.includes('cultur') || cat.includes('art') || cat.includes('gallery')) {
    return CATEGORY_FALLBACKS.museum;
  }
  if (cat.includes('attract') || cat.includes('sight') || cat.includes('tour')) {
    return CATEGORY_FALLBACKS.attraction;
  }
  if (cat.includes('shop') || cat.includes('market') || cat.includes('store')) {
    return CATEGORY_FALLBACKS.shopping;
  }
  if (cat.includes('park') || cat.includes('nature') || cat.includes('garden')) {
    return CATEGORY_FALLBACKS.nature;
  }

  // 4. Default Wanderlust Fallback
  return CATEGORY_FALLBACKS.attraction || DESTINATION_COVERS.wanderlust;
}
