'use client';

import React from 'react';
import * as ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { AnimeItem } from '@/lib/mockData';
import Image from 'next/image';
import { X } from 'lucide-react';
import type { Layout } from 'react-grid-layout';

const RGL = ReactGridLayout as any;
const GridLayout = RGL.default || RGL;

interface AnimeGridProps {
    items: (AnimeItem & { layoutId: string })[];
    layout: Layout[];
    onLayoutChange: (layout: Layout[]) => void;
    onRemoveItem: (id: string) => void;
    onDrop?: (layout: Layout[], item: Layout, event: Event) => void;
    droppingItem?: { w: number; h: number; i: string; minW?: number; minH?: number };
    axisLabels: { top: string; bottom: string; left: string; right: string };
    dockId?: string;
    isDockOpen?: boolean;
    scale?: number;
}

export default function AnimeGrid({ items, layout, onLayoutChange, onRemoveItem, onDrop, droppingItem, axisLabels, dockId, isDockOpen, scale = 1 }: AnimeGridProps) {
    const [mounted, setMounted] = React.useState(false);
    // ...
    // ... in JSX ...


    React.useEffect(() => {
        setMounted(true);
    }, []);

    const handleDragStop = (layout: Layout[], oldItem: Layout, newItem: Layout, placeholder: Layout, e: MouseEvent, element: HTMLElement) => {
        if (dockId) {
            const dock = document.getElementById(dockId);
            if (dock) {
                const rect = dock.getBoundingClientRect();
                if (e.clientY >= rect.top && e.clientY <= rect.bottom &&
                    e.clientX >= rect.left && e.clientX <= rect.right) {
                    onRemoveItem((newItem as any).i);
                }
            }
        }
    };

    // Manual fallback for drop handling
    const handleContainerDrop = (e: React.DragEvent) => {
        e.preventDefault();
        // If the drop target is strictly the grid layout wrapper or an empty space, handle it manually
        // We rely on RGL's internal handling if it works, but if not, this catches it.
        // However, RGL might not propagate the event if it handles it.
        // Let's implement this as the PRIMARY handler if RGL's isDroppable is failing in this environment.

        const container = e.currentTarget;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - container.scrollLeft - rect.left; // Adjust for scroll if necessary, but here scroll is on parent
        const relX = e.clientX - rect.left;
        const relY = e.clientY - rect.top;

        // Calculate Grid Position (20px cells)
        const col = Math.floor(relX / 20);
        const row = Math.floor(relY / 20);

        // Get dimensions from droppingItem or default
        const w = droppingItem?.w || 6;
        const h = droppingItem?.h || 8;

        const layoutItem: Layout = {
            i: '__dropping_manual__',
            x: col,
            y: row,
            w: (droppingItem && droppingItem.w) || 3, // Fallback to 3
            h: (droppingItem && droppingItem.h) || 3, // Fallback to 3
            minW: 3,
            minH: 3,
            isResizable: false
        };

        // Call the parent's onDrop handler
        // Note: The first arg (layout) is technically unused by our current handler implementation
        if (onDrop) {
            onDrop(layout, layoutItem, e.nativeEvent);
        }
    };

    const [dragPos, setDragPos] = React.useState<{ x: number; y: number } | null>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        const container = e.currentTarget;
        const rect = container.getBoundingClientRect();

        // Calculate relative position accounting for scale if necessary
        // Note: RGL handles scale internally, but our calculation for grid cells needs raw pixels relative to container top-left
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Grid Dimensions: 20px squares
        const col = Math.floor(x / 20);
        const row = Math.floor(y / 20);

        setDragPos({ x: col, y: row });
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
            id="anime-grid-content"
            className="relative group/grid"
            onDragOver={handleDragOver}
            onDragEnter={(e) => e.preventDefault()}
            onDrop={(e) => {
                setDragPos(null); // Reset on drop
                handleContainerDrop(e);
            }}
            style={{
                position: 'relative',
                width: '1000px', // Strict width
                height: '1000px', // Strict height
                // Visual Grid Pattern: 20px squares
                backgroundImage: `
                    linear-gradient(to right, rgba(75, 85, 99, 0.3) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(75, 85, 99, 0.3) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px',
                backgroundColor: 'rgba(17, 24, 39, 0.5)'
            }}
        >
            {/* Axis Lines & Origin - Absolute (Scrolls with grid) */}
            <div
                className="rounded-xl overflow-hidden absolute inset-0 pointer-events-none z-0"
                style={{ width: '1000px', height: '1000px' }} // Explicitly set width/height for the grid content area
            >
                {/* Y Axis line */}
                <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-blue-400/80 shadow-[0_0_10px_rgba(96,165,250,0.5)] transform -translate-x-1/2 z-10"></div>
                {/* X Axis line */}
                <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-blue-400/80 shadow-[0_0_10px_rgba(96,165,250,0.5)] transform -translate-y-1/2 z-10"></div>

                {/* Center Origin Mark */}
                <div className="absolute left-1/2 top-1/2 w-3 h-3 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-20 shadow-[0_0_15px_rgba(59,130,246,1)]"></div>
            </div>

            {/* HUD / Labels Layer - Fixed Position to maintain visibility */}
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

            <GridLayout
                className="layout z-10"
                style={{ height: '1000px' }}
                layout={layout}
                cols={50} // 50 cols * 20px = 1000px
                rowHeight={20} // 20px Row Height
                width={1000}
                transformScale={scale}
                onDragStop={handleDragStop}
                onLayoutChange={onLayoutChange}
                margin={[0, 0]}
                containerPadding={[0, 0]}
                compactType={null}
                preventCollision={false}
                isResizable={false}
                isDroppable={true}
                onDrop={onDrop}
                droppingItem={droppingItem ? { ...droppingItem, ...dragPos } : undefined}
            >
                {items.filter(item => layout.some(l => (l as any).i === item.layoutId)).map((item) => (
                    <div key={item.layoutId} className="group relative bg-gray-800 rounded-none border border-gray-700 overflow-hidden shadow-none hover:shadow-md transition-shadow !w-[60px] !h-[60px]">
                        <div className="absolute top-0 right-0 z-20 opacity-0 group-hover:opacity-100">
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemoveItem(item.layoutId); }}
                                className="bg-red-500/80 text-white w-full h-full flex items-center justify-center hover:bg-red-600"
                                style={{ width: '100%', height: '100%' }}
                            >
                                <X size={10} />
                            </button>
                        </div>
                        <div className="w-full h-full relative cursor-move">
                            <Image
                                src={item.imageUrl}
                                alt={item.title}
                                fill
                                unoptimized
                                className="object-cover pointer-events-none"
                                sizes="60px"
                            />
                        </div>
                    </div>
                ))}
            </GridLayout>

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
