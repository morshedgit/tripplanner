import { describe, it, expect } from 'vitest';
import { getPlaceImageUrl, getDestinationCoverUrl, DESTINATION_COVERS, CATEGORY_FALLBACKS } from '../src/lib/placeImages';

describe('Issue #27: Curated Place Imagery & Destination Covers', () => {
  it('resolves high-resolution destination covers with fallback to wanderlust', () => {
    expect(getDestinationCoverUrl('Rome, Italy')).toBe(DESTINATION_COVERS.rome);
    expect(getDestinationCoverUrl('Florence')).toBe(DESTINATION_COVERS.florence);
    expect(getDestinationCoverUrl('Tuscany')).toBe(DESTINATION_COVERS.tuscany);
    expect(getDestinationCoverUrl('Venice')).toBe(DESTINATION_COVERS.venice);
    expect(getDestinationCoverUrl('Kyoto, Japan')).toBe(DESTINATION_COVERS.kyoto);
    expect(getDestinationCoverUrl('Tokyo')).toBe(DESTINATION_COVERS.tokyo);
    expect(getDestinationCoverUrl('Paris, France')).toBe(DESTINATION_COVERS.paris);
    expect(getDestinationCoverUrl('New York City')).toBe(DESTINATION_COVERS['new york']);
    expect(getDestinationCoverUrl('London, UK')).toBe(DESTINATION_COVERS.london);
    expect(getDestinationCoverUrl('Unknown City')).toBe(DESTINATION_COVERS.wanderlust);

    // Custom URL precedence
    const custom = 'https://custom-image.com/my-trip.jpg';
    expect(getDestinationCoverUrl('Tokyo', custom)).toBe(custom);
  });

  it('resolves curated Italian POI imagery', () => {
    const italianPois = [
      'Colosseum',
      'Roman Forum',
      'Pantheon',
      'Trevi Fountain',
      'Piazza Navona',
      'Vatican Museums',
      "St. Peter's Basilica",
      "Castel Sant'Angelo",
      'Galleria Borghese',
      'Trastevere',
      'Duomo Firenze',
      'Uffizi Gallery',
      'Accademia David',
      'Ponte Vecchio',
      'Piazzale Michelangelo',
      'Mercato Centrale',
      'Palazzo Pitti',
      'Siena Cathedral',
      'Leaning Tower of Pisa',
      "St. Mark's Basilica",
      "Doge's Palace",
      'Rialto Bridge',
      'Burano & Murano',
      'Peggy Guggenheim Collection',
      "Villa d'Este",
      'Santa Maria Novella',
      'Libreria Acqua Alta',
    ];

    for (const poi of italianPois) {
      const url = getPlaceImageUrl(poi);
      expect(url).toBeDefined();
      expect(url).toContain('https://images.unsplash.com/');
    }
  });

  it('resolves curated Kyoto & Japan POI imagery', () => {
    const kyotoPois = [
      'Fushimi Inari Taisha',
      'Kinkaku-ji (Golden Pavilion)',
      'Kiyomizu-dera',
      'Arashiyama Bamboo Grove',
      'Tenryu-ji',
      'Nishiki Market',
      'Nijo Castle',
      'Gion District',
    ];

    for (const poi of kyotoPois) {
      const url = getPlaceImageUrl(poi);
      expect(url).toBeDefined();
      expect(url).toContain('https://images.unsplash.com/');
    }
  });

  it('resolves category fallbacks when place name is generic', () => {
    expect(getPlaceImageUrl('Random Spot', 'attraction')).toBe(CATEGORY_FALLBACKS.attraction);
    expect(getPlaceImageUrl('Some Modern Gallery', 'museum')).toBe(CATEGORY_FALLBACKS.museum);
    expect(getPlaceImageUrl('A Cozy Bistro', 'restaurant')).toBe(CATEGORY_FALLBACKS.restaurant);
    expect(getPlaceImageUrl('Grand Luxury Inn', 'lodging')).toBe(CATEGORY_FALLBACKS.lodging);
    expect(getPlaceImageUrl('Central Station', 'transit')).toBe(CATEGORY_FALLBACKS.transit);
    expect(getPlaceImageUrl('Vintage Souvenirs', 'shopping')).toBe(CATEGORY_FALLBACKS.shopping);
    expect(getPlaceImageUrl('Forest Trails', 'nature')).toBe(CATEGORY_FALLBACKS.nature);
  });
});
