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
    axisLabels: { top: string; bottom: string; left: string; right: string };
    dockId?: string;
    isDockOpen?: boolean;
}

export default function AnimeGrid({ items, layout, onLayoutChange, onRemoveItem, axisLabels, dockId, isDockOpen }: AnimeGridProps) {
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
            className="relative group/grid"
            style={{
                position: 'relative',
                minWidth: '2000px', // Ensure background covers even if scrolled
                minHeight: '2000px', // Ensure background covers even if scrolled
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
                style={{ width: '2000px', height: '2000px' }} // Explicitly set width/height for the grid content area
            >
                {/* Y Axis line */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-600/50 transform -translate-x-1/2"></div>
                {/* X Axis line */}
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-600/50 transform -translate-y-1/2"></div>

                {/* Center Origin Mark */}
                <div className="absolute left-1/2 top-1/2 w-1 h-1 bg-gray-400 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
            </div>

            {/* HUD / Labels Layer - Fixed Position to maintain visibility */}
            {/* Top Label */}
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                <span className="text-xs font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm">
                    {axisLabels.top} ▲
                </span>
            </div>
            {/* Bottom Label - Dynamic position based on Dock */}
            <div className={`fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-500 ease-in-out ${isDockOpen ? 'bottom-72' : 'bottom-16'}`}>
                <span className="text-xs font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm">
                    ▼ {axisLabels.bottom}
                </span>
            </div>
            {/* Left Label */}
            <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
                <span className="text-xs font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm">
                    ◀ {axisLabels.left}
                </span>
            </div>
            {/* Right Label */}
            <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
                <span className="text-xs font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm">
                    {axisLabels.right} ▶
                </span>
            </div>

            <GridLayout
                className="layout z-10"
                layout={layout}
                cols={100} // 100 cols * 20px = 2000px
                rowHeight={20} // 20px Row Height
                width={2000}
                onDragStop={handleDragStop}
                onLayoutChange={onLayoutChange}
                resizeHandles={['se']}
                margin={[0, 0]}
                containerPadding={[0, 0]}
                compactType={null}
                preventCollision={false}
            >
                {items.filter(item => layout.some(l => (l as any).i === item.layoutId)).map((item) => (
                    <div key={item.layoutId} className="group relative bg-gray-800 rounded-none border border-gray-700 overflow-hidden shadow-none hover:shadow-md transition-shadow">
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
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <div className="text-gray-600/50 text-4xl font-bold uppercase tracking-widest text-center">
                        Place Your<br />Bias Here
                    </div>
                </div>
            )}
        </div>
    );
}
