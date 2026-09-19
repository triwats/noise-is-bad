import { fitFontSize } from './fitText';

describe('fitFontSize', () => {
  it('gets smaller as the text gets longer', () => {
    const short = fitFontSize('auth', 1000, 600);
    const long = fitFontSize('checkout-service-europe-west', 1000, 600);

    expect(long).toBeLessThan(short);
  });

  it('gets bigger as the box gets bigger', () => {
    expect(fitFontSize('checkout', 1920, 1080)).toBeGreaterThan(fitFontSize('checkout', 600, 400));
  });

  it('is limited by height in a wide, short box', () => {
    const size = fitFontSize('auth', 4000, 100);

    expect(size).toBeCloseTo(40);
  });

  it('is limited by width in a tall, narrow box', () => {
    const size = fitFontSize('checkout', 200, 4000);

    expect(size).toBeLessThan(4000 * 0.4);
  });

  it('never goes below the smallest size allowed', () => {
    expect(fitFontSize('a-very-long-service-name-indeed', 10, 10)).toBe(12);
    expect(fitFontSize('checkout', 0, 0, { minimum: 8 })).toBe(8);
  });

  it('copes with no text', () => {
    expect(fitFontSize('', 1000, 600)).toBeGreaterThan(0);
    expect(Number.isFinite(fitFontSize('', 1000, 600))).toBe(true);
  });

  it('uses a custom height limit', () => {
    const half = fitFontSize('a', 10_000, 1000, { heightFraction: 0.5 });

    expect(half).toBeCloseTo(500);
  });
});

describe('checked against real capital letters', () => {
  // Measured in a browser: bold uppercase renders at about 0.66 of the font
  // size per glyph. The estimate must not be more optimistic than that, or
  // names bleed out of their tiles.
  const MEASURED_GLYPH_WIDTH = 0.66;

  it.each([
    ['auth', 200, 120],
    ['search', 186, 140],
    ['checkout', 570, 300],
    ['checkout-service-eu', 400, 300],
  ])('keeps %s inside a %ix%i box', (name, width, height) => {
    const size = fitFontSize(name, width, height);
    const rendered = size * name.length * MEASURED_GLYPH_WIDTH;

    expect(rendered).toBeLessThanOrEqual(width);
  });
});
