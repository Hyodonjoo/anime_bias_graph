'use client';

import React, { useRef, useState, useEffect } from 'react';
import Draggable, { DraggableEventHandler, DraggableData, DraggableEvent } from 'react-draggable';
import { AnimeItem } from '@/lib/mockData';
import Image from 'next/image';
import { Layout } from '@/types/layout';
import { resolveLayout, collides } from '@/lib/gridUtils';

interface AnimeGridProps {
    items: (AnimeItem & { layoutId: string })[];
    layout: Layout[];
    onLayoutChange: (layout: Layout[]) => void;
    onRemoveItem: (id: string) => void;
    onDrop: (layout: Layout[], item: Layout, event: DragEvent) => void;
    axisLabels: { top: string; bottom: string; left: string; right: string };
    dockId?: string;
    isDockOpen?: boolean;
    scale?: number;
    onDragStateChange?: (isDragging: boolean) => void;
    onUpdateTag?: (id: string, tag: string) => void;
    isExport?: boolean;
    offset?: { x: number; y: number };
    showAxisLabels?: boolean;
}

// Inner component to handle individual item drag state for performance
const DraggableGridItem = ({
    item,
    layoutItem,
    onDrag,
    onStop,
    onRemove,
    scale,
    isDragging,
    onUpdateTag,
    isExport
}: {
    item: AnimeItem & { layoutId: string };
    layoutItem: Layout;
    onDrag: (id: string, x: number, y: number) => void;
    onStop: (id: string, x: number, y: number, e: DraggableEvent) => void;
    onRemove: (id: string) => void;
    scale: number;
    isDragging: boolean;
    onUpdateTag?: (id: string, tag: string) => void;
    isExport?: boolean;
}) => {
    // Local state for smooth dragging without dragging parent constantly
    const [position, setPosition] = useState({ x: layoutItem.x, y: layoutItem.y });
    const nodeRef = useRef(null);
    const [isEditingTag, setIsEditingTag] = useState(false);
    const [tagInput, setTagInput] = useState(item.tag || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditingTag && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditingTag]);

    // Sync if parent updates layout (e.g. from DB load or PUSH effect)
    // IMPORTANT: Do NOT sync if this item is currently being dragged by the user,
    // otherwise it fights with the mouse position.
    useEffect(() => {
        if (!isDragging) {
            setPosition({ x: layoutItem.x, y: layoutItem.y });
        }
    }, [layoutItem.x, layoutItem.y, isDragging]);

    const handleDrag: DraggableEventHandler = (e, data) => {
        if (isExport) return;
        setPosition({ x: data.x, y: data.y });
        onDrag(item.layoutId, data.x, data.y);
    };

    const handleStop: DraggableEventHandler = (e, data) => {
        if (isExport) return;
        setPosition({ x: data.x, y: data.y });
        onStop(item.layoutId, data.x, data.y, e);
    };

    const handleStartEdit = (e: React.MouseEvent) => {
        if (isExport) return;
        e.stopPropagation();
        e.preventDefault();
        if (!onUpdateTag) return;
        setTagInput(item.tag || '');
        setIsEditingTag(true);
    };

    const handleTagSubmit = () => {
        setIsEditingTag(false);
        if (onUpdateTag) {
            onUpdateTag(item.layoutId, tagInput.trim());
        }
    };

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            handleTagSubmit();
        } else if (e.key === 'Escape') {
            setIsEditingTag(false);
            setTagInput(item.tag || '');
        }
    };

    return (
        <Draggable
            nodeRef={nodeRef}
            position={position}
            onDrag={handleDrag}
            onStop={handleStop}
            scale={scale}
            bounds="parent" // Constraint to grid area
            disabled={isExport}
        >
            <div
                ref={nodeRef}
                className={`group absolute bg-gray-800 rounded-none border border-gray-700 overflow-visible shadow-none ${isExport ? '' : 'hover:shadow-md cursor-move'} transition-shadow anime-grid-card touch-none`}
                style={{
                    width: '100px',
                    height: '100px',
                    left: 0,
                    position: 'absolute'
                }}
            >
                <div className="w-full h-full relative pointer-events-none">
                    <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="60px"
                    />
                </div>

                {/* Tag Display / Editor */}
                {isEditingTag ? (
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-[60]">
                        <input
                            ref={inputRef}
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            maxLength={12}
                            onBlur={handleTagSubmit}
                            onKeyDown={handleTagKeyDown}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="bg-black/90 text-white text-[12px] px-2 py-1 rounded border border-blue-500 outline-none text-center w-24 shadow-lg"
                            placeholder="Tag..."
                        />
                    </div>
                ) : (
                    item.tag && (
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[12px] px-1.5 py-0.5 rounded whitespace-nowrap z-50 pointer-events-none shadow-sm">
                            {item.tag}
                        </div>
                    )
                )}

                {/* Edit Tag Button - Top Right - Hide in Export */}
                {!isExport && (
                    <div
                        onClick={handleStartEdit}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 hover:bg-blue-400 text-white rounded-full flex items-center justify-center cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-sm z-50"
                        title="Edit Tag"
                    >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                    </div>
                )}
            </div>
        </Draggable>
    );
};

// Helper: Check intersection (Moved to gridUtils)
// Helper: Check intersection (Moved to gridUtils)

export default function AnimeGrid({ items, layout, onLayoutChange, onRemoveItem, onDrop, axisLabels, dockId, isDockOpen, scale = 1, onDragStateChange, onUpdateTag, isExport = false, offset = { x: 0, y: 0 }, showAxisLabels = true }: AnimeGridProps) {
    const [mounted, setMounted] = React.useState(false);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const handleItemDragStart = (id: string) => {
        setDraggingId(id);
        if (onDragStateChange) onDragStateChange(true);
    };

    const handleItemDrag = (id: string, x: number, y: number) => {
        // ... (existing logic)
        // Find current item
        const verifyItem = layout.find(l => l.i === id);
        if (!verifyItem) return;

        const movingItem = { ...verifyItem, x, y };
        // Just update the moving item, do NOT resolve collisions for others during drag
        const newLayout = layout.map(l => l.i === id ? movingItem : l);

        onLayoutChange(newLayout);
    };

    const handleItemDragStop = (id: string, x: number, y: number, e: DraggableEvent) => {
        setDraggingId(null);
        if (onDragStateChange) onDragStateChange(false);
        // ... (rest of simple logic: Dock removal check, final position sync)

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
                        if (onDragStateChange) onDragStateChange(false); // Ensure false if returning early
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
        if (isExport) return;
        e.preventDefault();
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();

        // Calculate position relative to the container, accounting for scale and center origin
        // Calculate position relative to the container, accounting for scale and center origin
        // Formula: GridCoord = Center + (ScreenCoord - ScreenCenter - Translate) / Scale


        const domCenterX = rect.width / 2;
        const domCenterY = rect.height / 2;

        const logicalCenterX = 500; // GRID_SIZE / 2
        const logicalCenterY = 500;

        const x = logicalCenterX + (e.clientX - rect.left - domCenterX - offset.x) / scale;
        const y = logicalCenterY + (e.clientY - rect.top - domCenterY - offset.y) / scale;

        const layoutItem: Layout = {
            i: '__dropping_elem__', // handled by parent
            x: Math.max(0, x - 50), // Center (100/2)
            y: Math.max(0, y - 50),
            w: 100,
            h: 100
        };

        if (onDrop) {
            // Pre-resolve collision for the dropped item
            const prospectiveLayout = [...layout, layoutItem];
            const resolvedLayout = resolveLayout(prospectiveLayout, layoutItem);

            // Pass the FULL resolved layout (including pushed items) to parent
            onDrop(resolvedLayout, layoutItem, e.nativeEvent as DragEvent);
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
            id={isExport ? "anime-grid-export" : "anime-grid-content"} // Different ID for export
            className={`relative flex flex-col justify-between shrink-0 ${isExport ? '' : 'group/grid overflow-hidden'}`}
            onDragOver={handleDragOver}
            onDrop={handleDropInternal}
            style={{
                width: '1000px', // Fixed size
                height: '1000px',
                // Use scale 1 for export, otherwise props
                transform: isExport ? 'none' : undefined,
                backgroundColor: isExport ? '#0c0a09' : 'rgba(17, 24, 39, 0.5)' // Solid black for export, trans for UI
            }}
        >
            {/* Visual Content Layer - Scaled (Absolute Background) */}
            <div
                className="absolute top-0 left-0 origin-center z-0 pointer-events-none"
                style={{
                    width: '1000px',
                    height: '1000px',
                    // Force scale 1 for export
                    transform: isExport ? 'none' : `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    backgroundImage: `
                        linear-gradient(to right, rgba(75, 85, 99, 0.3) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(75, 85, 99, 0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0'
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
            <div className="absolute inset-0 z-10 pointer-events-auto origin-center"
                style={{ width: '1000px', height: '1000px', transform: isExport ? 'none' : `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}>
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
                            scale={isExport ? 1 : scale}
                            isDragging={draggingId === item.layoutId}
                            onUpdateTag={onUpdateTag}
                            isExport={isExport}
                        />
                    );
                })}
            </div>
            {/* Labels Layer - Removed from Grid, moved to Page */}
            {/* Empty State */}
            {items.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 data-hide-export" style={{ width: '100%', height: '100%' }}>
                    <div className="text-gray-600/50 text-4xl font-bold uppercase tracking-widest text-center" style={{ transform: isExport ? 'scale(1)' : `scale(${scale})` }}>
                        Place Your<br />Bias Here
                    </div>
                </div>
            )}
        </div>
    );
}
