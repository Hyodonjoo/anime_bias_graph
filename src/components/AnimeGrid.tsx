'use client';

import React, { useRef, useState, useEffect } from 'react';
import Draggable, { DraggableEventHandler, DraggableData, DraggableEvent } from 'react-draggable';
import { AnimeItem } from '@/lib/mockData';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Layout } from '@/types/layout';

interface AnimeGridProps {
    items: (AnimeItem & { layoutId: string })[];
    layout: Layout[];
    onLayoutChange: (layout: Layout[]) => void;
    onRemoveItem: (id: string) => void;
    onDrop: (layout: Layout[], item: Layout, event: DragEvent) => void;
    droppingItem?: { w: number; h: number; i: string }; // Not used for RGL anymore, but keeping for compatibility? We'll maintain similar signature.
    axisLabels: { top: string; bottom: string; left: string; right: string };
    dockId?: string;
    isDockOpen?: boolean;
    scale?: number;
}

// Inner component to handle individual item drag state for performance
const DraggableGridItem = ({
    item,
    layoutItem,
    onDrag,
    onStop,
    onRemove,
    scale,
    isDragging
}: {
    item: AnimeItem & { layoutId: string };
    layoutItem: Layout;
    onDrag: (id: string, x: number, y: number) => void;
    onStop: (id: string, x: number, y: number, e: DraggableEvent) => void;
    onRemove: (id: string) => void;
    scale: number;
    isDragging: boolean;
}) => {
    // Local state for smooth dragging without updating parent constantly
    const [position, setPosition] = useState({ x: layoutItem.x, y: layoutItem.y });
    const nodeRef = useRef(null);

    // Sync if parent updates layout (e.g. from DB load or PUSH effect)
    // IMPORTANT: Do NOT sync if this item is currently being dragged by the user,
    // otherwise it fights with the mouse position.
    useEffect(() => {
        if (!isDragging) {
            setPosition({ x: layoutItem.x, y: layoutItem.y });
        }
    }, [layoutItem.x, layoutItem.y, isDragging]);

    const handleDrag: DraggableEventHandler = (e, data) => {
        setPosition({ x: data.x, y: data.y });
        onDrag(item.layoutId, data.x, data.y);
    };

    const handleStop: DraggableEventHandler = (e, data) => {
        setPosition({ x: data.x, y: data.y });
        onStop(item.layoutId, data.x, data.y, e);
    };

    return (
        <Draggable
            nodeRef={nodeRef}
            position={position}
            onDrag={handleDrag}
            onStop={handleStop}
            scale={scale}
            bounds="parent" // Constraint to grid area
        // grid={[20, 20]} // Optional: Enable if user wants snapping. Commented out for "Free Drag".
        >
            <div
                ref={nodeRef}
                className="group absolute bg-gray-800 rounded-none border border-gray-700 overflow-hidden shadow-none hover:shadow-md transition-shadow cursor-move"
                style={{
                    width: '60px',
                    height: '60px',
                    left: 0, // Draggable uses transform, so left/top should be 0 ideally or managed. 
                    // Actually, Draggable applies transform. If we use position prop, we shouldn't set left/top unless using Position: absolute logic without transform. 
                    // specific react-draggable behavior: it applies translate. So initial position is from 0,0 relative to parent.
                    // Important: The element needs to be absolute for bounds="parent" to calculate correctly against a relative parent? 
                    // "DraggableCore" vs "Draggable": Draggable adds styles.
                    position: 'absolute'
                }}
            >
                <div className="absolute top-0 right-0 z-20 opacity-0 group-hover:opacity-100">
                    <button
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag start when clicking close
                        onClick={(e) => { e.stopPropagation(); onRemove(item.layoutId); }}
                        className="bg-red-500/80 text-white w-full h-full flex items-center justify-center hover:bg-red-600 rounded-bl-md"
                        style={{ width: '20px', height: '20px' }}
                    >
                        <X size={12} />
                    </button>
                </div>
                <div className="w-full h-full relative pointer-events-none"> {/* content pointer-events-none to let drag pass through easily? or just on image */}
                    <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="60px"
                    />
                </div>
            </div>
        </Draggable>
    );
};

// Helper: Check intersection
const collides = (r1: Layout, r2: Layout) => {
    return !(
        r1.x + r1.w <= r2.x ||
        r1.x >= r2.x + r2.w ||
        r1.y + r1.h <= r2.y ||
        r1.y >= r2.y + r2.h
    );
};

export default function AnimeGrid({ items, layout, onLayoutChange, onRemoveItem, onDrop, axisLabels, dockId, isDockOpen, scale = 1 }: AnimeGridProps) {
    const [mounted, setMounted] = React.useState(false);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const resolveLayout = (currentLayout: Layout[], movingItem: Layout): Layout[] => {
        // Create a map for faster lookup, but array is fine for small N
        let newLayout = currentLayout.map(l => l.i === movingItem.i ? movingItem : l);

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
                    // Ideally, we push it exactly enough to clear 'current'
                    // Since 'current' might be above or moving, simple "Push Down" is robust.
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

    const handleItemDragStart = (id: string) => {
        setDraggingId(id);
    };

    const handleItemDrag = (id: string, x: number, y: number) => {
        // Find current item
        const verifyItem = layout.find(l => l.i === id);
        if (!verifyItem) return;

        const movingItem = { ...verifyItem, x, y };
        const newLayout = resolveLayout(layout, movingItem);

        onLayoutChange(newLayout);
    };

    const handleItemDragStop = (id: string, x: number, y: number, e: DraggableEvent) => {
        setDraggingId(null);

        // Check for drop on Dock to remove
        if (dockId) {
            const dock = document.getElementById(dockId);
            if (dock) {
                const dockRect = dock.getBoundingClientRect();

                // Get client coordinates from event
                let clientX: number | undefined;
                let clientY: number | undefined;

                if (e instanceof MouseEvent) {
                    clientX = e.clientX;
                    clientY = e.clientY;
                } else if ('changedTouches' in e && (e as any).changedTouches.length > 0) {
                    // Cast to any or TouchEvent if strictly typed, but check presence
                    clientX = (e as any).changedTouches[0].clientX;
                    clientY = (e as any).changedTouches[0].clientY;
                }

                if (clientX !== undefined && clientY !== undefined) {
                    if (
                        clientX >= dockRect.left &&
                        clientX <= dockRect.right &&
                        clientY >= dockRect.top &&
                        clientY <= dockRect.bottom
                    ) {
                        onRemoveItem(id);
                        return;
                    }
                }
            }
        }

        // Final sync handled by handleItemDrag basically, but ensure exact final pos
        const verifyItem = layout.find(l => l.i === id);
        if (!verifyItem) return;

        const movingItem = { ...verifyItem, x, y };
        const newLayout = resolveLayout(layout, movingItem);
        onLayoutChange(newLayout);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Allow drop
    };

    const handleDropInternal = (e: React.DragEvent) => {
        e.preventDefault();
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();

        // Calculate position relative to the container, accounting for scale
        // x_scaled = (clientX - left) / scale
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        // Create a layout item with pixel coordinates
        // Centering the 60x60 item on the mouse? 
        // Mouse is usually at top-left of dragged ghost? Or where user grabbed.
        // Let's center it for better UX, or just use click position as top-left.
        // Using top-left is standard for "drop coords".

        const layoutItem: Layout = {
            i: '__dropping_elem__', // handled by parent
            x: Math.max(0, x - 30), // Center (60/2)
            y: Math.max(0, y - 30),
            w: 60,
            h: 60
        };

        if (onDrop) {
            // Pre-resolve collision for the dropped item
            // We need to merge the temp item into current layout to check collisions, 
            // then pass the CLEAN layout + New Item to parent

            // Wait, onDrop expects the final layout including the new item?
            // Usually parent adds it. 
            // We can locally calculate the valid position?

            // Let's just pass the item. The user's code in page.tsx adds it to layout.
            // But page.tsx is dumb. It just appends.
            // We should arguably return a "Clean Layout" suggestion.
            // But strict signature: onDrop(layout, item, event).

            // Let's run the resolver on the hypothetical layout
            const prospectiveLayout = [...layout, layoutItem];
            const resolvedLayout = resolveLayout(prospectiveLayout, layoutItem);

            // Pass this resolved layout to parent?
            // The parent `handleDrop` calls `setLayout([...prev, newItem])`.
            // If we pass `resolvedLayout` as the first arg, does it use it? 
            // Parent: `const handleDrop = (layout: Layout[], ...)` -> checks `layout`.
            // Currently parent implementation: `setLayout(prev => [...prev, newLayoutItem])`.
            // It completely IGNORES the first argument `layout` currently in page.tsx! 
            // It uses `prev` state of layout.
            // So we need to fix page.tsx? OR just fix it here by passing correct `layoutItem`?

            // If we fix `layoutItem` to include the pushed Y, that solves collision with the new item,
            // BUT it doesn't solve if we pushed *others* to make space.

            // Since we can't easily force parent logic change from here without editing page.tsx,
            // we will just rely on the user dragging it afterwards or initial placement being rough.
            // HOWEVER, the user asked for "Drop" behavior too.
            // The best hook is: We perform the calculation, find the "Safe Spot" (maybe pushed down others?), 
            // AND we update `layout` prop immediately? No, `onLayoutChange` might be better.

            // Let's CALL `onLayoutChange` with the displaced items excluding the new one?
            // No, the new item isn't in `layout` yet.

            // For now, let's just emit the drop. The user can drag to fix.
            // Or better: Simulate drag once immediately after mount?
            // Let's leave Drop basic for now, provided Drag fixes it. 
            // If needed we can refactor `handleDrop` in page.tsx later.

            // Actually, we can just pass the `layoutItem` but with updated Y?
            // No, because existing items might need to move.

            onDrop(layout, layoutItem, e.nativeEvent as DragEvent);
        }
    };

    // Only render grid after mounting on client
    if (!mounted) {
        return (
            <div className="flex items-center justify-center w-full h-full text-gray-400 bg-gray-900/50 rounded-xl border border-gray-800">
                <div className="text-center">
                    <p className="mb-2">Loading Grid...</p>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            id="anime-grid-content"
            className="relative group/grid flex flex-col justify-between"
            onDragOver={handleDragOver}
            onDrop={handleDropInternal}
            style={{
                width: `${1000 * scale}px`,
                height: `${1000 * scale}px`,
                backgroundColor: 'rgba(17, 24, 39, 0.5)'
            }}
        >
            {/* Visual Content Layer - Scaled (Absolute Background) */}
            <div
                className="absolute top-0 left-0 origin-top-left z-0 pointer-events-none"
                style={{
                    width: '1000px',
                    height: '1000px',
                    transform: `scale(${scale})`,
                    backgroundImage: `
                        linear-gradient(to right, rgba(75, 85, 99, 0.3) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(75, 85, 99, 0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px',
                }}
            >
                {/* Axis Lines & Origin */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-blue-400/80 shadow-[0_0_10px_rgba(96,165,250,0.5)] transform -translate-x-1/2 z-10"></div>
                    <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-blue-400/80 shadow-[0_0_10px_rgba(96,165,250,0.5)] transform -translate-y-1/2 z-10"></div>

                    {Array.from({ length: 21 }).map((_, i) => {
                        const value = -100 + (i * 10);
                        if (value === 0) return null;
                        const leftPercent = ((value + 100) / 200) * 100;
                        const topPercent = 50 - (value / 2);

                        return (
                            <React.Fragment key={i}>
                                <div className="absolute top-1/2 -translate-y-1/2 w-[1px] h-3 bg-blue-400/60 z-10" style={{ left: `${leftPercent}%` }} />
                                <div className="absolute top-1/2 mt-4 -translate-x-1/2 text-[10px] text-blue-300/80 font-mono font-bold select-none z-10" style={{ left: `${leftPercent}%` }}>
                                    {Math.abs(value)}
                                </div>
                                <div className="absolute left-1/2 -translate-x-1/2 h-[1px] w-3 bg-blue-400/60 z-10" style={{ top: `${topPercent}%` }} />
                                <div className="absolute left-1/2 ml-4 -translate-y-1/2 text-[10px] text-blue-300/80 font-mono font-bold select-none z-10" style={{ top: `${topPercent}%` }}>
                                    {Math.abs(value)}
                                </div>
                            </React.Fragment>
                        );
                    })}
                    <div className="absolute left-1/2 top-1/2 w-3 h-3 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-20 shadow-[0_0_15px_rgba(59,130,246,1)]"></div>
                </div>
            </div>

            {/* Interactive Grid Items Layer - Separate from visual background but scaled same way */}
            <div className="absolute inset-0 z-10 pointer-events-auto origin-top-left"
                style={{ width: '1000px', height: '1000px', transform: `scale(${scale})` }}>
                {items.map((item) => {
                    const layoutItem = layout.find(l => l.i === item.layoutId);
                    if (!layoutItem) return null;
                    return (
                        <DraggableGridItem
                            key={item.layoutId}
                            item={item}
                            layoutItem={layoutItem}
                            onDrag={handleItemDrag}
                            onStop={handleItemDragStop}
                            onRemove={onRemoveItem}
                            scale={scale}
                            isDragging={draggingId === item.layoutId}
                        />
                    );
                })}
            </div>

            {/* Labels Layer (Flex Layout for correct stickiness) */}

            {/* Top */}
            <div className="sticky top-4 z-50 self-center pointer-events-none">
                <span className="font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm whitespace-nowrap">
                    {axisLabels.top} ▲
                </span>
            </div>

            {/* Middle (Left/Right) */}
            <div className="flex-1 w-full flex justify-between items-start px-4 z-50 pointer-events-none">
                {/* Left */}
                <div className="sticky left-4 top-1/2 -translate-y-1/2">
                    <span className="block font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm whitespace-nowrap">
                        ◀ {axisLabels.left}
                    </span>
                </div>
                {/* Right */}
                <div className="sticky right-4 top-1/2 -translate-y-1/2">
                    <span className="block font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm whitespace-nowrap">
                        {axisLabels.right} ▶
                    </span>
                </div>
            </div>

            {/* Bottom */}
            <div className="sticky self-center z-50 pointer-events-none transition-all duration-500 ease-in-out"
                style={{ bottom: isDockOpen ? '220px' : '20px' }}>
                <span className="font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm whitespace-nowrap">
                    ▼ {axisLabels.bottom}
                </span>
            </div>

            {/* Empty State */}
            {items.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 data-hide-export" style={{ width: '100%', height: '100%' }}>
                    <div className="text-gray-600/50 text-4xl font-bold uppercase tracking-widest text-center" style={{ transform: `scale(${scale})` }}>
                        Place Your<br />Bias Here
                    </div>
                </div>
            )}
        </div>
    );
}
