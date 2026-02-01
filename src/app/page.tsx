'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Layout } from 'react-grid-layout';
import AnimeGrid from '@/components/AnimeGrid';
import AnimeDock from '@/components/AnimeDock';
import { AnimeItem, MOCK_ANIME_LIST, MOCK_THEME, MOCK_AXIS } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

export default function Home() {
  const [themeTitle, setThemeTitle] = useState(MOCK_THEME);
  const [axisLabels, setAxisLabels] = useState(MOCK_AXIS);
  const [dockItems, setDockItems] = useState<AnimeItem[]>(MOCK_ANIME_LIST);
  const [gridItems, setGridItems] = useState<(AnimeItem & { layoutId: string })[]>([]);
  const [isDockOpen, setIsDockOpen] = useState(true);

  // Fixed layout state instead of responsive breakpoints
  const [layout, setLayout] = useState<Layout[]>([]);
  const [mounted, setMounted] = useState(false);

  // Drag to Scroll Refs
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const scrollPosRef = useRef({ left: 0, top: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!gridContainerRef.current) return;
    // Allow default interaction (e.g. text selection or clicking buttons) unless it's the specific background
    // But since we want "Drag Map", usually background drag is intended.
    isPanningRef.current = true;
    startPosRef.current = { x: e.pageX, y: e.pageY };
    scrollPosRef.current = {
      left: gridContainerRef.current.scrollLeft,
      top: gridContainerRef.current.scrollTop
    };
    gridContainerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current || !gridContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - startPosRef.current.x;
    const y = e.pageY - startPosRef.current.y;
    gridContainerRef.current.scrollLeft = scrollPosRef.current.left - x;
    gridContainerRef.current.scrollTop = scrollPosRef.current.top - y;
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    if (gridContainerRef.current) {
      gridContainerRef.current.style.cursor = 'grab';
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchActiveTheme();
  }, []);

  const fetchActiveTheme = async () => {
    try {
      const { data: themes, error } = await supabase
        .from('themes')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error || !themes) {
        console.log('Using mock data (database empty or error)');
        return;
      }

      setThemeTitle(themes.title);
      setAxisLabels({
        top: themes.axis_top,
        bottom: themes.axis_bottom,
        left: themes.axis_left,
        right: themes.axis_right
      });

      // Fetch anime items for this theme
      const { data: animeItems } = await supabase
        .from('anime_items')
        .select('*')
        .eq('theme_id', themes.id);

      if (animeItems && animeItems.length > 0) {
        const formattedItems = animeItems.map((item: any) => ({
          id: item.id,
          title: item.title,
          imageUrl: item.image_url,
          year: item.year
        }));
        setDockItems(formattedItems);
      }

    } catch (e) {
      console.error("Error fetching theme:", e);
    }
  };

  const handleLayoutChange = (newLayout: Layout[]) => {
    // Sanitize Layout: Fix weird size issues (e.g. 15x62 bug)
    const sanitizedLayout = newLayout.map(l => {
      let changed = false;
      const newItem: any = { ...l };

      // Force square 3x3 if it goes crazy
      if (newItem.w > 10 || newItem.h > 10) {
        console.warn(`Sanitizing item ${newItem.i}: Size was ${newItem.w}x${newItem.h}, forcing to 3x3`);
        newItem.w = 3;
        newItem.h = 3;
        changed = true;
      }

      // Ensure min size
      if (newItem.minW !== 3) newItem.minW = 3;
      if (newItem.minH !== 3) newItem.minH = 3;

      return newItem;
    });

    console.log("Layout Change Recieived:", sanitizedLayout);
    setLayout(sanitizedLayout);
  };

  const handleRemoveItem = (id: string) => {
    const itemToRemove = gridItems.find(i => i.layoutId === id);
    if (!itemToRemove) return;

    setGridItems(prev => prev.filter(i => i.layoutId !== id));
    setDockItems(prev => [...prev, itemToRemove]);
    setLayout(prev => prev.filter(l => (l as any).i !== id));
  };

  if (!mounted) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading...</div>;

  return (
    <main className="flex h-screen flex-col bg-gray-950 text-white overflow-hidden font-sans selection:bg-purple-500/30 relative">
      {/* Header */}
      <header className="h-16 px-6 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 flex justify-between items-center z-50 shadow-lg shrink-0 relative">
        <div className="flex items-center gap-4">
          <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            {themeTitle}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400 border border-gray-700">
            Drag & Drop Off
          </span>
          <span className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400 border border-gray-700">
            Auto-Save: Off
          </span>
        </div>
      </header>

      {/* Main Content - Grid Area */}
      <div
        className="flex-1 relative overflow-auto flex flex-col bg-gray-950 cursor-grab active:cursor-grabbing scrollbar-hide"
        ref={gridContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Hide Scrollbar
      >
        <AnimeGrid
          items={gridItems}
          layout={layout}
          onLayoutChange={handleLayoutChange}
          onRemoveItem={handleRemoveItem}
          axisLabels={axisLabels}
          dockId="anime-dock"
          isDockOpen={isDockOpen}
        />
      </div>

      {/* Bottom Dock - Floating Drawer */}
      <div
        id="anime-dock"
        className={`fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out
          ${isDockOpen ? 'bottom-6' : '-bottom-[11rem]'} 
          w-[95vw] md:w-[90vw] lg:w-[1400px] h-48`}
      >
        {/* Toggle Handle */}
        <button
          onClick={() => setIsDockOpen(!isDockOpen)}
          className="absolute -top-8 left-1/2 -translate-x-1/2 h-8 px-12 bg-gray-800/90 hover:bg-gray-700 backdrop-blur-md border-t border-x border-gray-600/50 rounded-t-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors shadow-[0_-5px_15px_rgba(0,0,0,0.3)] group"
        >
          {isDockOpen ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity absolute left-4">Close</span>
              <ChevronDown size={16} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity absolute left-4">Open</span>
              <ChevronUp size={16} />
            </div>
          )}
        </button>

        {/* Dock Content */}
        <div className="w-full h-full bg-gray-900/90 backdrop-blur-2xl border border-gray-700/50 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/10">
          <AnimeDock items={dockItems} />
        </div>
      </div>
    </main>
  );
}
