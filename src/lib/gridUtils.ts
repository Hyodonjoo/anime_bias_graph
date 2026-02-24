import { Layout } from '@/types/layout';

// Helper: Check intersection (with overlap margin)
export const collides = (r1: Layout, r2: Layout) => {
    // 포스터의 크기(w, h)에 비례하여 15% 정도의 가장자리가 겹치는 것을 허용합니다.
    const getMarginX = (w: number) => w * 0.15;
    const getMarginY = (h: number) => h * 0.15;

    const m1x = getMarginX(r1.w);
    const m1y = getMarginY(r1.h);
    const m2x = getMarginX(r2.w);
    const m2y = getMarginY(r2.h);

    return !(
        r1.x + r1.w - m1x <= r2.x + m2x ||
        r1.x + m1x >= r2.x + r2.w - m2x ||
        r1.y + r1.h - m1y <= r2.y + m2y ||
        r1.y + m1y >= r2.y + r2.h - m2y
    );
};

export const resolveLayout = (currentLayout: Layout[], movingItem: Layout): Layout[] => {
    // Update layout mapping
    const newLayout = currentLayout.map(l => l.i === movingItem.i ? movingItem : l);

    // Simple cascade push
    // 큐에 항목의 ID만 저장하여 후속 충돌 검사 시 항상 최신 레이아웃 좌표를 참조하도록 함
    // 이를 통해 여러 항목이 동시에 밀려날 때 과거 좌표 참조로 인해 서로 겹쳐버리는 버그를 해결합니다.
    const itemsToProcess = [movingItem.i];
    let iterations = 0;

    // 무한 루프 방지를 위한 iterations 제한 (안전장치)
    while (itemsToProcess.length > 0 && iterations < 1000) {
        iterations++;
        const currentId = itemsToProcess.shift()!;
        const current = newLayout.find(l => l.i === currentId);

        if (!current) continue;

        for (let i = 0; i < newLayout.length; i++) {
            const other = newLayout[i];
            if (other.i === current.i) continue;

            // If collision
            if (collides(current, other)) {
                // Push 'other' down
                // 완전히 아래로 밀어내지 않고 높이의 30% 정도가 겹치게 여유롭게 밀어냅니다.
                // (각 항목당 15% 여유 마진의 합 = 30%)
                const PUSH_OVERLAP = current.h * 0.30;
                const newY = current.y + current.h - PUSH_OVERLAP;

                if (other.y < newY) {
                    const updatedOther = { ...other, y: newY };
                    newLayout[i] = updatedOther;

                    // 최신 데이터로 업데이트된 항목이 연쇄 충돌을 발생시키는지 확인하기 위해 큐에 추가
                    if (!itemsToProcess.includes(other.i)) {
                        itemsToProcess.push(other.i);
                    }
                }
            }
        }
    }
    return newLayout;
};
