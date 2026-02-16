import { describe, it, expect } from 'vitest';
import { collides, resolveLayout } from '@/lib/gridUtils';
import { Layout } from '@/types/layout';

describe('gridUtils', () => {
    describe('collides', () => {
        it('should return true when rectangles overlap fully', () => {
            const r1 = { i: '1', x: 0, y: 0, w: 2, h: 2 };
            const r2 = { i: '2', x: 0, y: 0, w: 2, h: 2 };
            expect(collides(r1, r2)).toBe(true);
        });

        it('should return true when rectangles overlap partially', () => {
            const r1 = { i: '1', x: 0, y: 0, w: 4, h: 4 };
            const r2 = { i: '2', x: 2, y: 2, w: 4, h: 4 };
            expect(collides(r1, r2)).toBe(true);
        });

        it('should return false when rectangles are disjoint horizontally', () => {
            const r1 = { i: '1', x: 0, y: 0, w: 2, h: 2 };
            const r2 = { i: '2', x: 3, y: 0, w: 2, h: 2 };
            expect(collides(r1, r2)).toBe(false);
        });

        it('should return false when rectangles are disjoint vertically', () => {
            const r1 = { i: '1', x: 0, y: 0, w: 2, h: 2 };
            const r2 = { i: '2', x: 0, y: 3, w: 2, h: 2 };
            expect(collides(r1, r2)).toBe(false);
        });

        it('should return false when rectangles touch at edges but do not overlap', () => {
            const r1 = { i: '1', x: 0, y: 0, w: 2, h: 2 };
            const r2 = { i: '2', x: 2, y: 0, w: 2, h: 2 };
            expect(collides(r1, r2)).toBe(false);
        });
    });

    describe('resolveLayout', () => {
        // Since resolveLayout logic is complex and specific to the implementation
        // Let's test basic collision resolution
        it('should not change layout if no collision occurs', () => {
            const initialLayout: Layout[] = [
                { i: '1', x: 0, y: 0, w: 2, h: 2 },
                { i: '2', x: 4, y: 0, w: 2, h: 2 }
            ];
            const movingItem = { i: '1', x: 0, y: 0, w: 2, h: 2 }; // Same position
            const result = resolveLayout(initialLayout, movingItem);

            expect(result).toEqual(initialLayout);
        });
    });
});
