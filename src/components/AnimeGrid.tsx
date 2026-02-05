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
    onStop,
    onRemove,
    scale
}: {
    item: AnimeItem & { layoutId: string };
    layoutItem: Layout;
    onStop: (id: string, x: number, y: number) => void;
    onRemove: (id: string) => void;
    scale: number;
}) => {
    // Local state for smooth dragging without updating parent constantly
    const [position, setPosition] = useState({ x: layoutItem.x, y: layoutItem.y });
    const nodeRef = useRef(null);

    // Sync if parent updates layout (e.g. from DB load)
    useEffect(() => {
        setPosition({ x: layoutItem.x, y: layoutItem.y });
    }, [layoutItem.x, layoutItem.y]);

    const handleDrag: DraggableEventHandler = (e, data) => {
        setPosition({ x: data.x, y: data.y });
    };

    const handleStop: DraggableEventHandler = (e, data) => {
        setPosition({ x: data.x, y: data.y });
        onStop(item.layoutId, data.x, data.y);
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

export default function AnimeGrid({ items, layout, onLayoutChange, onRemoveItem, onDrop, axisLabels, dockId, isDockOpen, scale = 1 }: AnimeGridProps) {
    const [mounted, setMounted] = React.useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const handleItemDragStop = (id: string, x: number, y: number) => {
        // Update layout state in parent
        const newLayout = layout.map(l => {
            if (l.i === id) {
                return { ...l, x, y };
            }
            return l;
        });
        // If item doesn't exist in layout (edge case), add it? No, it should exist if rendered.
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
            className="relative group/grid"
            onDragOver={handleDragOver}
            onDrop={handleDropInternal}
            style={{
                position: 'relative',
                width: '1000px', // Strict width
                height: '1000px', // Strict height
                // Visual Grid Pattern: 20px squares (keeping current aesthetic)
                backgroundImage: `
                    linear-gradient(to right, rgba(75, 85, 99, 0.3) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(75, 85, 99, 0.3) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px',
                backgroundColor: 'rgba(17, 24, 39, 0.5)'
            }}
        >
            {/* Axis Lines & Origin - Absolute */}
            <div className="absolute inset-0 pointer-events-none z-0">
                {/* Y Axis line */}
                <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-blue-400/80 shadow-[0_0_10px_rgba(96,165,250,0.5)] transform -translate-x-1/2 z-10"></div>
                {/* X Axis line */}
                <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-blue-400/80 shadow-[0_0_10px_rgba(96,165,250,0.5)] transform -translate-y-1/2 z-10"></div>
                {/* Center Origin Mark */}
                <div className="absolute left-1/2 top-1/2 w-3 h-3 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-20 shadow-[0_0_15px_rgba(59,130,246,1)]"></div>
            </div>

            {/* Labels - Fixed/Absolute relative to this container (or handled by parent in fixed overlay? In RGL it was Fixed inside relative container?) 
               Wait, the previous code had `fixed` position labels inside the component. `fixed` positions are relative to viewport, not parent.
               The user styled them as `fixed`. I will keep them `fixed` but ensure they toggle/hide as requested.
            */}

            {/* Top Label */}
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none data-hide-export">
                <span className="font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm" style={{ fontSize: '2vh' }}>
                    {axisLabels.top} ▲
                </span>
            </div>
            {/* Bottom Label - Dynamic position based on Dock */}
            <div className={`fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-500 ease-in-out data-hide-export ${isDockOpen ? 'bottom-72' : 'bottom-16'}`}>
                <span className="font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm" style={{ fontSize: '2vh' }}>
                    ▼ {axisLabels.bottom}
                </span>
            </div>
            {/* Left Label */}
            <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none data-hide-export">
                <span className="font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm" style={{ fontSize: '2vh' }}>
                    ◀ {axisLabels.left}
                </span>
            </div>
            {/* Right Label */}
            <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none data-hide-export">
                <span className="font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm" style={{ fontSize: '2vh' }}>
                    {axisLabels.right} ▶
                </span>
            </div>

            {/* Grid Items Layer */}
            <div className="absolute inset-0 z-10">
                {items.map((item) => {
                    const layoutItem = layout.find(l => l.i === item.layoutId);
                    if (!layoutItem) return null; // Should not happen if utilized correctly
                    return (
                        <DraggableGridItem
                            key={item.layoutId}
                            item={item}
                            layoutItem={layoutItem}
                            onStop={handleItemDragStop}
                            onRemove={onRemoveItem}
                            scale={scale}
                        />
                    );
                })}
            </div>

            {/* Empty State */}
            {items.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 data-hide-export">
                    <div className="text-gray-600/50 text-4xl font-bold uppercase tracking-widest text-center">
                        Place Your<br />Bias Here
                    </div>
                </div>
            )}
        </div>
    );
}
