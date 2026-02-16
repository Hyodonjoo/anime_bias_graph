import { Layout } from '@/types/layout';

// Helper: Check intersection
export const collides = (r1: Layout, r2: Layout) => {
    return !(
        r1.x + r1.w <= r2.x ||
        r1.x >= r2.x + r2.w ||
        r1.y + r1.h <= r2.y ||
        r1.y >= r2.y + r2.h
    );
};

export const resolveLayout = (currentLayout: Layout[], movingItem: Layout): Layout[] => {
    // Update layout mapping
    const newLayout = currentLayout.map(l => l.i === movingItem.i ? movingItem : l);

    // Simple cascade push
    const itemsToProcess = [movingItem];
    const processed = new Set<string>();

    while (itemsToProcess.length > 0) {
        const current = itemsToProcess.shift()!;
        if (processed.has(current.i)) continue;
        processed.add(current.i);

        for (let i = 0; i < newLayout.length; i++) {
            const other = newLayout[i];
            if (other.i === current.i) continue;

            // If collision
            if (collides(current, other)) {
                // Push 'other' down
                // New Y = current.y + current.h
                const newY = current.y + current.h;

                if (other.y < newY) {
                    const updatedOther = { ...other, y: newY };
                    newLayout[i] = updatedOther;
                    itemsToProcess.push(updatedOther);
                }
            }
        }
    }
    return newLayout;
};
