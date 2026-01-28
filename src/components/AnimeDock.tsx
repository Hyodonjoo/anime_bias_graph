'use client';

import React from 'react';
import { AnimeItem } from '@/lib/mockData';
import Image from 'next/image';

interface AnimeDockProps {
    items: AnimeItem[];
}

export default function AnimeDock({ items }: AnimeDockProps) {
    const handleDragStart = (e: React.DragEvent, item: AnimeItem) => {
        // Required for react-grid-layout dropper
        e.dataTransfer.setData("text/plain", JSON.stringify(item));
        // This specific format is often looked for by internal logic or custom handling, 
        // but standard RGL droppable feature uses the drag event data.
        // We pass the item data so we can recover it in the onDrop handler.
    };

    return (
        <div className="w-full h-48 bg-gray-900 border-t border-gray-800 flex flex-col">
            <div className="px-4 py-2 border-b border-gray-800 bg-gray-950">
                <h3 className="text-sm font-semibold text-gray-400">Available Anime</h3>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 flex gap-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {items.map((item) => (
                    <div
                        key={item.id}
                        draggable={true}
                        unselectable="on"
                        onDragStart={(e) => handleDragStart(e, item)}
                        className="flex-shrink-0 w-32 h-full bg-gray-800 rounded-lg border border-gray-700 overflow-hidden cursor-grab active:cursor-grabbing hover:scale-105 transition-transform relative group"
                    >
                        <div className="relative w-full h-[80%]">
                            {/* Optimization: Use standard img for drag preview consistency usually, but Next Image is fine if loaded. */}
                            <Image
                                src={item.imageUrl}
                                alt={item.title}
                                fill
                                unoptimized
                                className="object-cover pointer-events-none"
                                sizes="128px"
                            />
                        </div>
                        <div className="h-[20%] flex items-center justify-center p-1 bg-gray-850">
                            <span className="text-xs text-center text-gray-300 truncate w-full block">{item.title}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
