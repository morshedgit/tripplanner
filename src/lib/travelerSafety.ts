/**
 * src/lib/travelerSafety.ts
 *
 * Traveler Operational Safety Net
 *
 * Provides real-world ground intelligence to prevent travelers from getting
 * surprised, lost, stranded, or exhausted:
 * 1. "Never Stranded": Station exit guidance, last-transit cutoffs, luggage transitions
 * 2. "Zero Surprise": Last entry times, closed days, advance reservations, cash-only alerts
 * 3. "Never Lost": High-contrast native script cards for taxi drivers & locals
 * 4. "Energy & Contingency": Daily step count / pacing gauge, weather fallback flags
 */

export interface PlaceSafetyMeta {
  localName: string;
  localAddress?: string;
  pronunciation?: string;
  stationExit?: string;
  lastEntryTime?: string;
  closingTime?: string;
  paymentMode: 'cash_only' | 'card_ok' | 'ic_card_ok';
  paymentLabel: string;
  reservationRequired: boolean;
  reservationNote?: string;
  luggageAdvice: string;
  lastTransitCutoff?: string;
  stepsEstimate: number;
  isIndoor: boolean;
  dressCodeOrEtiquette?: string;
}

export interface DaySafetyAudit {
  totalEstimatedSteps: number;
  pacingLevel: 'Relaxed' | 'Moderate' | 'Active' | 'Intense';
  cashOnlyCount: number;
  cashOnlyPlaces: string[];
  reservationsRequired: string[];
  closingWarnings: string[];
  tightTransfers: string[];
  luggageTips: string[];
  weatherResilience: 'High (Covered)' | 'Mixed' | 'Outdoor Dependent';
}

const SAFETY_POI_CATALOG: Record<string, Partial<PlaceSafetyMeta>> = {
  // KYOTO
  'fushimi inari taisha': {
    localName: '伏見稲荷大社',
    localAddress: '京都府京都市伏見区深草藪之内町68',
    pronunciation: 'Fushimi Inari Taisha',
    stationExit: 'JR Inari Station (Main Exit, 1 min walk) or Keihan Fushimi-Inari (Exit 1, 5 min walk)',
    closingTime: 'Open 24 hours (Shrine precinct)',
    lastEntryTime: 'Open 24 hours (Inner trails dark after sunset)',
    paymentMode: 'cash_only',
    paymentLabel: 'Cash Only (Amulets & Vendors)',
    reservationRequired: false,
    luggageAdvice: 'Small coin lockers at JR Inari Station; large luggage best left at Kyoto Station.',
    lastTransitCutoff: 'JR Nara Line to Kyoto Station runs until 23:55',
    stepsEstimate: 6500,
    isIndoor: false,
    dressCodeOrEtiquette: 'Steep cobblestone steps; comfortable walking shoes essential.',
  },
  'kinkaku-ji': {
    localName: '金閣寺 (鹿苑寺)',
    localAddress: '京都府京都市北区金閣寺町1',
    pronunciation: 'Kinkaku-ji (Rokuon-ji)',
    stationExit: 'Kyoto City Bus #205 or #12 to "Kinkakuji-michi" stop (3 min walk)',
    closingTime: '17:00',
    lastEntryTime: '16:30',
    paymentMode: 'cash_only',
    paymentLabel: 'Cash Only Entry (¥500)',
    reservationRequired: false,
    luggageAdvice: 'No luggage storage on site. Drop bags at Kyoto Station locker before boarding bus.',
    lastTransitCutoff: 'City Bus #205 back to Kyoto Station runs until 22:30',
    stepsEstimate: 3200,
    isIndoor: false,
    dressCodeOrEtiquette: 'One-way walking path through garden; no tripods allowed.',
  },
  'kinkaku-ji (golden pavilion)': {
    localName: '金閣寺 (鹿苑寺)',
    localAddress: '京都府京都市北区金閣寺町1',
    pronunciation: 'Kinkaku-ji (Rokuon-ji)',
    stationExit: 'Kyoto City Bus #205 or #12 to "Kinkakuji-michi" stop (3 min walk)',
    closingTime: '17:00',
    lastEntryTime: '16:30',
    paymentMode: 'cash_only',
    paymentLabel: 'Cash Only Entry (¥500)',
    reservationRequired: false,
    luggageAdvice: 'No luggage storage on site. Drop bags at Kyoto Station locker before boarding bus.',
    lastTransitCutoff: 'City Bus #205 back to Kyoto Station runs until 22:30',
    stepsEstimate: 3200,
    isIndoor: false,
    dressCodeOrEtiquette: 'One-way walking path through garden; no tripods allowed.',
  },
  'arashiyama bamboo grove': {
    localName: '嵐山 竹林の小径',
    localAddress: '京都府京都市右京区嵯峨小倉山田淵山町',
    pronunciation: 'Arashiyama Chikurin no Komichi',
    stationExit: 'Keifuku Arashiyama Station (5 min walk) or JR Saga-Arashiyama (South Exit, 12 min walk)',
    closingTime: 'Open 24 hours',
    lastEntryTime: 'Best before 08:30 AM to avoid crowds',
    paymentMode: 'card_ok',
    paymentLabel: 'Free Public Path',
    reservationRequired: false,
    luggageAdvice: 'Coin lockers available inside JR Saga-Arashiyama and Hankyu Arashiyama stations.',
    lastTransitCutoff: 'JR San-in Line to Kyoto Station runs until 23:40',
    stepsEstimate: 4200,
    isIndoor: false,
    dressCodeOrEtiquette: 'Stay on paved walkway; rickshaws share the path.',
  },
  'tenryu-ji': {
    localName: '天龍寺',
    localAddress: '京都府京都市右京区嵯峨天龍寺芒ノ馬場町68',
    pronunciation: 'Tenryū-ji',
    stationExit: 'Keifuku Arashiyama Station (1 min walk) or JR Saga-Arashiyama (10 min walk)',
    closingTime: '17:00',
    lastEntryTime: '16:50',
    paymentMode: 'cash_only',
    paymentLabel: 'Cash Only (¥500 garden / ¥300 halls)',
    reservationRequired: false,
    luggageAdvice: 'Coin lockers at Keifuku Randen Arashiyama Station directly opposite temple gate.',
    lastTransitCutoff: 'Keifuku Tram to Shijo-Omiya runs until 23:30',
    stepsEstimate: 2800,
    isIndoor: false,
    dressCodeOrEtiquette: 'Remove shoes when entering the main Hojo temple hall.',
  },
  'kiyomizu-dera': {
    localName: '清水寺',
    localAddress: '京都府京都市東山区清水1丁目294',
    pronunciation: 'Kiyomizu-dera',
    stationExit: 'Keihan Kiyomizu-Gojo Station (Exit 4, 20 min uphill) or Bus #206 to Gojo-zaka (10 min uphill)',
    closingTime: '18:00',
    lastEntryTime: '17:30',
    paymentMode: 'cash_only',
    paymentLabel: 'Cash Only Entry (¥400)',
    reservationRequired: false,
    luggageAdvice: 'Very steep uphill slope (Matsubara-dori); suitcases strictly not recommended.',
    lastTransitCutoff: 'Keihan Main Line trains run until 23:50',
    stepsEstimate: 5000,
    isIndoor: false,
    dressCodeOrEtiquette: 'Steep hill climb; quiet contemplation requested in main hall.',
  },
  'nishiki market': {
    localName: '錦市場',
    localAddress: '京都府京都市中京区錦小路通',
    pronunciation: 'Nishiki Ichiba',
    stationExit: 'Hankyu Karasuma Station (Exit 16, 3 min walk) or Subway Shijo Station (Exit 1)',
    closingTime: '18:00 (Stalls close gradually from 17:00)',
    lastEntryTime: '16:30 for fresh street food',
    paymentMode: 'cash_only',
    paymentLabel: 'Cash Preferred (Many stalls cash-only)',
    reservationRequired: false,
    luggageAdvice: 'Aisle is narrow (3 meters wide); rolling suitcases prohibited by vendors.',
    lastTransitCutoff: 'Hankyu Kyoto Line to Umeda runs until 23:45',
    stepsEstimate: 3000,
    isIndoor: true,
    dressCodeOrEtiquette: 'Eat in front of the stall where purchased; walking while eating is discouraged.',
  },
  'nijo castle': {
    localName: '二条城 (元離宮二条城)',
    localAddress: '京都府京都市中京区二条通堀川西入二条城町541',
    pronunciation: 'Nijō-jō',
    stationExit: 'Subway Tozai Line Nijojo-mae Station (Exit 1, immediate)',
    closingTime: '17:00',
    lastEntryTime: '16:00 (Ninomaru Palace closes 16:10)',
    paymentMode: 'card_ok',
    paymentLabel: 'Credit & IC Cards Accepted (¥800)',
    reservationRequired: false,
    luggageAdvice: 'Lockers and coin baggage room next to Ticket Office at East Gate.',
    lastTransitCutoff: 'Subway Tozai Line runs until 23:45',
    stepsEstimate: 4500,
    isIndoor: false,
    dressCodeOrEtiquette: 'No photography inside Ninomaru Palace; shoes removed at entry.',
  },
  'gion geisha district': {
    localName: '祇園 (花見小路)',
    localAddress: '京都府京都市東山区祇園町南側',
    pronunciation: 'Gion (Hanamikoji)',
    stationExit: 'Keihan Gion-Shijo Station (Exit 6, 2 min walk) or Hankyu Kyoto-Kawaramachi (Exit 1B)',
    closingTime: 'Atmospheric tea houses and lantern evening walks until 22:00',
    lastEntryTime: 'Dinner reservations usually close by 20:30',
    paymentMode: 'card_ok',
    paymentLabel: 'Credit Cards for Dining / Cash for small shops',
    reservationRequired: false,
    luggageAdvice: 'Leave bags at hotel before evening stroll.',
    lastTransitCutoff: 'Keihan Line runs until 23:50',
    stepsEstimate: 3500,
    isIndoor: false,
    dressCodeOrEtiquette: 'Photography strictly prohibited on private side alleys; fines apply.',
  },
  'ichiran kyoto kawaramachi': {
    localName: '一蘭 京都河原町店',
    localAddress: '京都府京都市中京区裏寺町598 蛸薬師OKIビル1F',
    pronunciation: 'Ichiran Kyōto Kawaramachi',
    stationExit: 'Hankyu Kyoto-Kawaramachi Station (Exit 9, 3 min walk)',
    closingTime: '06:00 AM (Open almost 24h)',
    lastEntryTime: 'Open late',
    paymentMode: 'ic_card_ok',
    paymentLabel: 'IC Card (Suica/Pasmo) & Cash Ticket Machine',
    reservationRequired: false,
    luggageAdvice: 'Compact dining stalls; small carry-on only, no room for large bags.',
    lastTransitCutoff: 'Hankyu Line runs until 23:45',
    stepsEstimate: 800,
    isIndoor: true,
    dressCodeOrEtiquette: 'Individual focus booths; fill order sheet with noodle firmness preference.',
  },

  // ROME & ITALY
  'colosseum': {
    localName: 'Colosseo (Parco Archeologico del Colosseo)',
    localAddress: 'Piazza del Colosseo, 1, 00184 Roma RM, Italy',
    pronunciation: 'Colosseo',
    stationExit: 'Metro Line B (Colosseo Station, Exit directly in front of monument)',
    closingTime: '19:15',
    lastEntryTime: '18:15 (Timed entry strictly enforced)',
    paymentMode: 'card_ok',
    paymentLabel: 'Cards Only / Online Booking Mandatory',
    reservationRequired: true,
    reservationNote: 'Timed reservation ticket mandatory weeks in advance; photo ID required at gate.',
    luggageAdvice: 'No large backpacks or rolling suitcases allowed inside; no bag deposit available.',
    lastTransitCutoff: 'Metro Line B runs until 23:30 (01:30 on Fri/Sat)',
    stepsEstimate: 5500,
    isIndoor: false,
    dressCodeOrEtiquette: 'Passports / official photo ID required matching ticket name.',
  },
  'vatican museums': {
    localName: 'Musei Vaticani e Cappella Sistina',
    localAddress: 'Viale Vaticano, 00165 Roma RM, Italy',
    pronunciation: 'Musei Vaticani',
    stationExit: 'Metro Line A (Ottaviano-San Pietro Station, 8 min walk to Viale Vaticano entrance)',
    closingTime: '19:00',
    lastEntryTime: '17:00 (Security lines can take 30 min)',
    paymentMode: 'card_ok',
    paymentLabel: 'Credit Card / Online Booking',
    reservationRequired: true,
    reservationNote: 'Advance booking mandatory to avoid 3-hour walk-up queue.',
    luggageAdvice: 'Free cloakroom available inside for umbrellas and medium bags; suitcases forbidden.',
    lastTransitCutoff: 'Metro Line A runs until 23:30 (01:30 Fri/Sat)',
    stepsEstimate: 7000,
    isIndoor: true,
    dressCodeOrEtiquette: 'Strict dress code: shoulders and knees must be covered in Sistine Chapel.',
  },
  'pantheon': {
    localName: 'Pantheon (Basilica di Santa Maria ad Martyres)',
    localAddress: 'Piazza della Rotonda, 00186 Roma RM, Italy',
    pronunciation: 'Pàn-te-on',
    stationExit: 'Bus #62, #64, #492 to "Largo di Torre Argentina" (5 min walk)',
    closingTime: '19:00',
    lastEntryTime: '18:30 (Weekend entry requires pre-booked slot)',
    paymentMode: 'card_ok',
    paymentLabel: 'Credit Card / €5 Ticket',
    reservationRequired: true,
    reservationNote: 'Online booking required on Saturdays, Sundays, and public holidays.',
    luggageAdvice: 'No luggage storage; cobblestone pedestrian piazza.',
    lastTransitCutoff: 'Bus lines run throughout central Rome until midnight',
    stepsEstimate: 2000,
    isIndoor: true,
    dressCodeOrEtiquette: 'Active basilica: covered shoulders and respectful silence required.',
  },
  'uffizi gallery': {
    localName: 'Galleria degli Uffizi',
    localAddress: 'Piazzale degli Uffizi, 6, 50122 Firenze FI, Italy',
    pronunciation: 'Galleria degli Uffizi',
    stationExit: 'From Firenze Santa Maria Novella (SMN) Station: 15 min walk through historic center',
    closingTime: '18:30',
    lastEntryTime: '17:30 (Closed Mondays)',
    paymentMode: 'card_ok',
    paymentLabel: 'Credit Cards Accepted',
    reservationRequired: true,
    reservationNote: 'Reservation ticket with assigned time slot strongly recommended.',
    luggageAdvice: 'Free cloakroom inside for backpacks; large rolling bags not permitted.',
    lastTransitCutoff: 'Tram T1 from SMN Station runs until 00:30',
    stepsEstimate: 5500,
    isIndoor: true,
    dressCodeOrEtiquette: 'No flash photography; liquids over 0.5L must be checked.',
  },
};

/**
 * Resolves safety and ground operations metadata for any place name.
 */
export function getPlaceSafetyMeta(placeName: string, destination?: string): PlaceSafetyMeta {
  const norm = placeName.toLowerCase().trim();
  const found = SAFETY_POI_CATALOG[norm];

  if (found) {
    return {
      localName: found.localName || placeName,
      localAddress: found.localAddress,
      pronunciation: found.pronunciation || placeName,
      stationExit: found.stationExit || 'Consult station local map for nearest pedestrian exit.',
      lastEntryTime: found.lastEntryTime,
      closingTime: found.closingTime,
      paymentMode: found.paymentMode || 'card_ok',
      paymentLabel: found.paymentLabel || 'Cards Accepted',
      reservationRequired: !!found.reservationRequired,
      reservationNote: found.reservationNote,
      luggageAdvice: found.luggageAdvice || 'Store large luggage at hotel or central station lockers.',
      lastTransitCutoff: found.lastTransitCutoff,
      stepsEstimate: found.stepsEstimate || 2500,
      isIndoor: !!found.isIndoor,
      dressCodeOrEtiquette: found.dressCodeOrEtiquette,
    };
  }

  // Smart heuristic defaults based on place name and destination
  const isJapan = /japan|kyoto|tokyo|osaka/i.test(destination || '') || /temple|shrine|ramen|taisha|dera|ji\b/i.test(placeName);
  const isMuseum = /museum|gallery|palace|castle|uffizi|louvre|vatican/i.test(placeName);
  const isMarketOrFood = /market|ramen|cafe|restaurant|bistro|bar|food/i.test(placeName);

  return {
    localName: placeName,
    pronunciation: placeName,
    stationExit: 'Follow signs to main street exit or local station information desk.',
    closingTime: isMuseum ? '17:30' : isMarketOrFood ? '21:00' : '18:00',
    lastEntryTime: isMuseum ? '16:45' : undefined,
    paymentMode: isJapan && isMarketOrFood ? 'cash_only' : 'card_ok',
    paymentLabel: isJapan && isMarketOrFood ? 'Cash Advised' : 'Cards Accepted',
    reservationRequired: isMuseum,
    reservationNote: isMuseum ? 'Check if online timed reservation is required' : undefined,
    luggageAdvice: 'Leave heavy bags at hotel before touring.',
    lastTransitCutoff: isJapan ? 'Major trains run until approx 23:45' : 'Metro runs until 23:30',
    stepsEstimate: isMuseum ? 4500 : isMarketOrFood ? 2000 : 3000,
    isIndoor: isMuseum || isMarketOrFood,
  };
}

/**
 * Audits an entire day's itinerary for operational feasibility,
 * physical pacing, closing time bottlenecks, and transit safety.
 */
export function auditDaySafety(
  dayStops: any[],
  dayDate: string,
  transitLegs: any[] = []
): DaySafetyAudit {
  let totalSteps = 0;
  const cashOnlyPlaces: string[] = [];
  const reservationsRequired: string[] = [];
  const closingWarnings: string[] = [];
  const tightTransfers: string[] = [];
  const luggageTips: string[] = [];
  let indoorStopsCount = 0;

  for (let i = 0; i < dayStops.length; i++) {
    const stop = dayStops[i];
    const safety = getPlaceSafetyMeta(stop.place_name || stop.name || '');

    totalSteps += safety.stepsEstimate;
    if (safety.isIndoor) indoorStopsCount++;

    if (safety.paymentMode === 'cash_only') {
      cashOnlyPlaces.push(stop.place_name);
    }

    if (safety.reservationRequired) {
      reservationsRequired.push(stop.place_name);
    }

    // Check closing hours vs arrival time
    if (stop.arrival_time && safety.closingTime && safety.closingTime !== 'Open 24 hours') {
      const arr = stop.arrival_time.replace(':', '');
      const close = safety.closingTime.slice(0, 5).replace(':', '');
      if (arr >= close) {
        closingWarnings.push(`⚠️ "${stop.place_name}" closes at ${safety.closingTime}, but your arrival is ${stop.arrival_time}!`);
      } else if (safety.lastEntryTime && safety.lastEntryTime !== 'Open 24 hours') {
        const lastEntry = safety.lastEntryTime.slice(0, 5).replace(':', '');
        if (arr >= lastEntry) {
          closingWarnings.push(`⚠️ "${stop.place_name}" last entry is ${safety.lastEntryTime}; arrival at ${stop.arrival_time} risks refusal.`);
        }
      }
    }

    // Luggage note on first or last stop of the day
    if (i === 0 && dayStops.length > 0) {
      luggageTips.push(`Morning start: Confirm bag drop at hotel or station lockers before heading to ${stop.place_name}.`);
    }
  }

  // Factor in walking between transit legs
  for (const leg of transitLegs) {
    if (leg.transit_mode === 'walking') {
      const walkKm = (leg.distance_meters || 0) / 1000;
      totalSteps += Math.round(walkKm * 1350); // ~1350 steps per km
    } else {
      // Transfer walking in stations
      totalSteps += 450;
    }

    // Flag tight transit transfers
    if (leg.distance_meters > 5000 && (leg.duration_seconds || 0) < 600) {
      tightTransfers.push(`Transfer to next stop has less than 10 mins buffer for a 5+ km distance.`);
    }
  }

  // Pacing category
  let pacingLevel: DaySafetyAudit['pacingLevel'] = 'Moderate';
  if (totalSteps < 8000) pacingLevel = 'Relaxed';
  else if (totalSteps < 14000) pacingLevel = 'Moderate';
  else if (totalSteps < 20000) pacingLevel = 'Active';
  else pacingLevel = 'Intense';

  // Weather resilience
  let weatherResilience: DaySafetyAudit['weatherResilience'] = 'Outdoor Dependent';
  if (dayStops.length > 0) {
    const indoorRatio = indoorStopsCount / dayStops.length;
    if (indoorRatio >= 0.7) weatherResilience = 'High (Covered)';
    else if (indoorRatio >= 0.35) weatherResilience = 'Mixed';
  }

  return {
    totalEstimatedSteps: totalSteps,
    pacingLevel,
    cashOnlyCount: cashOnlyPlaces.length,
    cashOnlyPlaces,
    reservationsRequired,
    closingWarnings,
    tightTransfers,
    luggageTips,
    weatherResilience,
  };
}
