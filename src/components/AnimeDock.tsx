'use client';

import React from 'react';
import { AnimeItem } from '@/lib/mockData';

import Image from 'next/image';

interface AnimeDockProps {
    items: AnimeItem[];
}

export default function AnimeDock({ items }: AnimeDockProps) {
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
                        onDragStart={(e) => {
                            e.dataTransfer.setData("application/json", JSON.stringify(item));
                            e.dataTransfer.setData("text/plain", ""); // Required for some browsers to allow dropping
                            e.dataTransfer.effectAllowed = "copyMove";
                        }}
                        className="flex-shrink-0 w-32 h-full bg-gray-800 rounded-lg border border-gray-700 overflow-hidden relative group hover:scale-105 transition-transform cursor-grab active:cursor-grabbing"
                    >
                        <div className="relative w-full h-[80%]">
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
