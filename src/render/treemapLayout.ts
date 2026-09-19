import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';

import { NoiseSignal } from '../noise/types';

/**
 * Works out how to share the screen between several problems (NIB-007).
 *
 * Just maths, no React: items in, boxes out. The packing is done by
 * d3-hierarchy, because the plan says not to spend time writing our own.
 */

export interface WeightedSignal extends NoiseSignal {
  /** How much screen this should get. Bigger means more space. */
  weight: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Tile = WeightedSignal & Rect;

interface Node {
  children?: WeightedSignal[];
}

/**
 * Arranges problems inside a box, biggest first.
 *
 * The order is always the same: heaviest first, then by name. Without that, two
 * boxes of equal weight could swap places on a refresh for no reason, which on
 * a screen on the wall looks like panic.
 */
export function layout<T extends WeightedSignal>(items: T[], width: number, height: number, gap = 0): Array<T & Rect> {
  if (items.length === 0 || width <= 0 || height <= 0) {
    return [];
  }

  // Problems with no weight still deserve the screen, shared out evenly.
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  const weighted = total > 0 ? items : items.map((item) => ({ ...item, weight: 1 }));

  const root = hierarchy<Node>({ children: weighted } as Node, (node) => node.children as Node[])
    .sum((node) => Math.max(0, (node as unknown as WeightedSignal).weight ?? 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || nameOf(a.data).localeCompare(nameOf(b.data)));

  // d3 gives back a version with positions on it; the input has none.
  const result = treemap<Node>().tile(treemapSquarify).size([width, height]).paddingInner(gap).round(true)(root);

  return result.leaves().map((leaf) => ({
    ...(leaf.data as unknown as T),
    x: leaf.x0,
    y: leaf.y0,
    width: Math.max(0, leaf.x1 - leaf.x0),
    height: Math.max(0, leaf.y1 - leaf.y0),
  }));
}

const nameOf = (data: Node): string => (data as unknown as WeightedSignal).name ?? '';
