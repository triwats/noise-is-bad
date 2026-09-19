import { CRITICAL, WARNING } from '../noise/types';

import { WeightedSignal, layout } from './treemapLayout';

const item = (name: string, weight: number): WeightedSignal => ({ name, severity: WARNING, weight });

const areaOf = (tiles: ReturnType<typeof layout>, name: string) => {
  const tile = tiles.find((t) => t.name === name)!;
  return tile.width * tile.height;
};

describe('layout', () => {
  it('gives nothing back for nothing', () => {
    expect(layout([], 1000, 600)).toEqual([]);
  });

  it('gives nothing back for a box with no room', () => {
    expect(layout([item('checkout', 1)], 0, 600)).toEqual([]);
    expect(layout([item('checkout', 1)], 1000, 0)).toEqual([]);
  });

  it('gives a lone problem the whole box', () => {
    const [tile] = layout([item('checkout', 1)], 1000, 600);

    expect(tile).toMatchObject({ x: 0, y: 0, width: 1000, height: 600 });
  });

  it('splits evenly between equals', () => {
    const tiles = layout([item('checkout', 1), item('search', 1)], 1000, 600);

    expect(areaOf(tiles, 'checkout')).toBeCloseTo(areaOf(tiles, 'search'), -2);
  });

  it('gives the heavier problem more screen', () => {
    const tiles = layout([item('checkout', 3), item('search', 1)], 1000, 600);

    expect(areaOf(tiles, 'checkout')).toBeGreaterThan(areaOf(tiles, 'search') * 2);
  });

  it('uses the whole box', () => {
    const tiles = layout([item('a', 3), item('b', 2), item('c', 1)], 1000, 600);
    const used = tiles.reduce((sum, t) => sum + t.width * t.height, 0);

    expect(used).toBeCloseTo(1000 * 600, -3);
  });

  it('keeps every tile inside the box', () => {
    const tiles = layout([item('a', 5), item('b', 3), item('c', 2), item('d', 1), item('e', 1)], 800, 450);

    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(800);
      expect(tile.y + tile.height).toBeLessThanOrEqual(450);
    }
  });

  it('never overlaps two tiles', () => {
    const tiles = layout([item('a', 4), item('b', 3), item('c', 2), item('d', 1)], 900, 500);

    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i];
        const b = tiles[j];
        const apart =
          a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it('splits the screen evenly when nothing carries any weight', () => {
    const tiles = layout([item('a', 0), item('b', 0)], 1000, 600);

    expect(tiles).toHaveLength(2);
    expect(areaOf(tiles, 'a')).toBeCloseTo(areaOf(tiles, 'b'), -2);
  });

  it('ignores a negative weight rather than inverting the layout', () => {
    const tiles = layout([item('a', -5), item('b', 1)], 1000, 600);

    expect(areaOf(tiles, 'b')).toBeGreaterThan(areaOf(tiles, 'a'));
  });

  it('lays the same problems out the same way every time', () => {
    const problems = [item('search', 2), item('checkout', 2), item('kafka', 2)];

    expect(layout(problems, 1000, 600)).toEqual(layout([...problems].reverse(), 1000, 600));
  });

  it('carries the severity through to the tile', () => {
    const tiles = layout([{ name: 'checkout', severity: CRITICAL, weight: 3 }], 1000, 600);

    expect(tiles[0].severity).toBe(CRITICAL);
  });

  it('leaves a gap between tiles when asked', () => {
    const tiles = layout([item('a', 1), item('b', 1)], 1000, 600, 10);
    const used = tiles.reduce((sum, t) => sum + t.width * t.height, 0);

    expect(used).toBeLessThan(1000 * 600);
  });
});
