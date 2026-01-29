'use client';

import React from 'react';
import * as ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { AnimeItem, MOCK_AXIS } from '@/lib/mockData';
import Image from 'next/image';
import { X } from 'lucide-react';

const RGL = ReactGridLayout as any;
const RGLResponsive = RGL.Responsive || RGL.default?.Responsive || RGL.ResponsiveGridLayout || RGL.default?.ResponsiveGridLayout;

// Custom WidthProvider fallback if missing from exports
const withWidthFallback = (ComposedComponent: any) => {
    return function WithWidth(props: any) {
        const [width, setWidth] = React.useState(1200);
        const [mounted, setMounted] = React.useState(false);
        const ref = React.useRef<HTMLDivElement>(null);

        React.useEffect(() => {
            setMounted(true);
            const output = ref.current;
            if (!output) return;

            const handleResize = () => {
                if (ref.current) setWidth(ref.current.offsetWidth);
            };

            handleResize(); // initial
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }, []);

        // Also use ResizeObserver if available for more robust sizing
        React.useEffect(() => {
            if (!ref.current || typeof ResizeObserver === 'undefined') return;
            const ro = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    setWidth(entry.contentRect.width);
                }
            });
            ro.observe(ref.current);
            return () => ro.disconnect();
        }, []);

        return (
            <div ref={ref} className={props.className} style={{ width: '100%', height: '100%', position: 'relative', ...props.style }}>
                {mounted && <ComposedComponent {...props} width={width} />}
            </div>
        );
    };
};

const WidthProvider = RGL.WidthProvider || RGL.default?.WidthProvider || withWidthFallback;
const ResponsiveGridLayout = RGLResponsive ? WidthProvider(RGLResponsive) : null;
import type { Layout } from 'react-grid-layout';

interface AnimeGridProps {
    items: (AnimeItem & { layoutId: string })[];
    layouts: { lg: Layout[] };
    onLayoutChange: (layout: Layout[], layouts: { lg: Layout[] }) => void;
    onDrop: (layout: Layout[], item: Layout, e: Event) => void;
    onRemoveItem: (id: string) => void;
}

export default function AnimeGrid({ items, layouts, onLayoutChange, onDrop, onRemoveItem }: AnimeGridProps) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    // Only render grid after mounting on client to avoid hydration mismatch and import issues
    if (!mounted || !ResponsiveGridLayout) {
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
            className="w-full h-full bg-gray-900/50 rounded-xl overflow-hidden relative group/grid"
            style={{ position: 'relative', width: '100%', height: '100%' }}
        >
            {/* Axis Background */}
            <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
            >
                {/* Y Axis line */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-600/50 transform -translate-x-1/2"></div>
                {/* X Axis line */}
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-600/50 transform -translate-y-1/2"></div>

                {/* Axis Labels */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-xs font-bold text-gray-400 bg-gray-900/80 px-2 py-1 rounded border border-gray-700" style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)' }}>
                    {MOCK_AXIS.top} ▲
                </div>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs font-bold text-gray-400 bg-gray-900/80 px-2 py-1 rounded border border-gray-700" style={{ position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)' }}>
                    ▼ {MOCK_AXIS.bottom}
                </div>
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-xs font-bold text-gray-400 bg-gray-900/80 px-2 py-1 rounded border border-gray-700" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
                    ◀ {MOCK_AXIS.left}
                </div>
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xs font-bold text-gray-400 bg-gray-900/80 px-2 py-1 rounded border border-gray-700" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
                    {MOCK_AXIS.right} ▶
                </div>

                {/* Center Origin Mark */}
                <div className="absolute left-1/2 top-1/2 w-2 h-2 bg-gray-400 rounded-full transform -translate-x-1/2 -translate-y-1/2" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}></div>
            </div>

            <ResponsiveGridLayout
                className="layout min-h-[600px] z-10"
                layouts={layouts}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                // Fine-grained grid: 24 cols, rowHeight 30px
                cols={{ lg: 24, md: 24, sm: 24, xs: 24, xxs: 24 }}
                rowHeight={30}
                isDroppable={true}
                onDrop={onDrop}
                onLayoutChange={(layout: Layout[], allLayouts: { [key: string]: Layout[] } | object) => onLayoutChange(layout, allLayouts as { lg: Layout[] })}
                resizeHandles={['se']}
                margin={[5, 5]}
                containerPadding={[0, 0]}
                compactType={null} // Free movement, no specific packing
                preventCollision={true} // User requested "겹침방지" (overlap prevention)
                droppingItem={{ i: "__dropping-elem__", w: 3, h: 7 }}
            >
                {items.map((item) => (
                    <div key={item.layoutId} className="group relative bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-md">
                        <div className="absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemoveItem(item.layoutId); }}
                                className="p-1 bg-red-500/80 rounded-full text-white hover:bg-red-600"
                            >
                                <X size={12} />
                            </button>
                        </div>
                        <div className="w-full h-full relative cursor-move">
                            <Image
                                src={item.imageUrl}
                                alt={item.title}
                                fill
                                unoptimized
                                className="object-cover pointer-events-none"
                                sizes="(max-width: 768px) 100px, 200px"
                            />
                            {/* Title overlay on hover only */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-[9px] text-white truncate text-center">{item.title}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </ResponsiveGridLayout>

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
