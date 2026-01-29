'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from 'react-grid-layout';
import AnimeGrid from '@/components/AnimeGrid';
import AnimeDock from '@/components/AnimeDock';
import { AnimeItem, MOCK_ANIME_LIST, MOCK_THEME, MOCK_AXIS } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [themeTitle, setThemeTitle] = useState(MOCK_THEME);
  const [axisLabels, setAxisLabels] = useState(MOCK_AXIS);
  const [dockItems, setDockItems] = useState<AnimeItem[]>(MOCK_ANIME_LIST);
  const [gridItems, setGridItems] = useState<(AnimeItem & { layoutId: string })[]>([]);
  const [layouts, setLayouts] = useState<{ lg: Layout[] }>({ lg: [] });
  const [mounted, setMounted] = useState(false);

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

  const handleDrop = (layout: Layout[], layoutItem: Layout, e: DragEvent) => {
    // e is a native ResizeObserver entry?? No, in RGL onDrop, the third arg is the Event.
    // However, generic Event might not have dataTransfer property in TS types without casting.
    const dragEvent = e as unknown as React.DragEvent;

    const itemDataString = dragEvent.dataTransfer?.getData("text/plain");
    if (!itemDataString) return;

    try {
      const itemData: AnimeItem = JSON.parse(itemDataString);

      // Avoid duplicates
      if (gridItems.some(i => i.id === itemData.id)) return;

      const newGridItem = { ...itemData, layoutId: itemData.id };

      setGridItems(prev => [...prev, newGridItem]);
      setDockItems(prev => prev.filter(i => i.id !== itemData.id));

      // Create new layout item based on drop position
      // The RGL internal state might update automatically for the 'dropping-elem', 
      // but we need to persist it as a real item with the correct ID.
      const newLayoutItem: Layout = {
        ...layoutItem,
        i: newGridItem.layoutId,
        w: 3,
        h: 7,
        minW: 2,
        minH: 4
      };

      setLayouts(prev => ({
        ...prev,
        lg: [...(prev.lg || []), newLayoutItem]
      }));

    } catch (err) {
      console.error("Failed to parse drop data", err);
    }
  };

  const handleLayoutChange = (layout: Layout[], allLayouts: { lg: Layout[] }) => {
    setLayouts(allLayouts);
  };

  const handleRemoveItem = (id: string) => {
    const itemToRemove = gridItems.find(i => i.layoutId === id);
    if (!itemToRemove) return;

    setGridItems(prev => prev.filter(i => i.layoutId !== id));
    setDockItems(prev => [...prev, itemToRemove]);

    setLayouts(prev => ({
      ...prev,
      lg: (prev.lg || []).filter(l => l.i !== id)
    }));
  };

  if (!mounted) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading...</div>;

  return (
    <main className="flex h-screen flex-col bg-gray-950 text-white overflow-hidden font-sans selection:bg-purple-500/30">
      {/* Header */}
      <header className="h-16 px-6 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 flex justify-between items-center z-20 shadow-lg shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            {themeTitle}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400 border border-gray-700">
            Drag & Drop
          </span>
          <span className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400 border border-gray-700">
            Auto-Save: Off
          </span>
        </div>
      </header>

      {/* Main Content - Grid Area */}
      <div
        className="flex-1 relative overflow-hidden flex flex-col"
        style={{
          backgroundImage: 'radial-gradient(#374151 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      >
        <AnimeGrid
          items={gridItems}
          layouts={layouts}
          onLayoutChange={handleLayoutChange}
          onDrop={handleDrop as any}
          onRemoveItem={handleRemoveItem}
          axisLabels={axisLabels}
        />
      </div>

      {/* Bottom Dock */}
      <div className="h-48 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] bg-gray-900/95 backdrop-blur-xl border-t border-gray-800 shrink-0">
        <AnimeDock items={dockItems} />
      </div>
    </main>
  );
}
