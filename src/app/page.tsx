'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Layout } from 'react-grid-layout';
import AnimeGrid from '@/components/AnimeGrid';
import AnimeDock from '@/components/AnimeDock';
import { AnimeItem, MOCK_ANIME_LIST, MOCK_THEME, MOCK_AXIS } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';
import { ChevronUp, ChevronDown, X, Download, Plus, Minus } from 'lucide-react';

export default function Home() {
  const [themeTitle, setThemeTitle] = useState(MOCK_THEME);
  const [axisLabels, setAxisLabels] = useState(MOCK_AXIS);
  const [dockItems, setDockItems] = useState<AnimeItem[]>(MOCK_ANIME_LIST);
  const [gridItems, setGridItems] = useState<(AnimeItem & { layoutId: string })[]>([]);
  const [isDockOpen, setIsDockOpen] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%

  // Configuration for dropped item size
  const DROP_SIZE = { w: 3, h: 3 };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.7));

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

  // Center the grid on mount
  useEffect(() => {
    if (mounted && gridContainerRef.current) {
      setTimeout(() => {
        const container = gridContainerRef.current;
        if (container) {
          container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
          container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
        }
      }, 100);
    }
  }, [mounted]);

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
    // Just update layout without forcing min sizes
    setLayout(newLayout);
  };

  const handleRemoveItem = (id: string) => {
    const itemToRemove = gridItems.find(i => i.layoutId === id);
    if (!itemToRemove) return;

    setGridItems(prev => prev.filter(i => i.layoutId !== id));
    setDockItems(prev => [...prev, itemToRemove]);
    setLayout(prev => prev.filter(l => (l as any).i !== id));
  };

  const handleDrop = (layout: Layout[], layoutItem: Layout, _event: Event) => {
    const event = _event as DragEvent;
    const data = event.dataTransfer?.getData("application/json");
    if (!data) return;

    try {
      const itemData = JSON.parse(data);
      // Remove from dock
      setDockItems(prev => prev.filter(i => i.id !== itemData.id));

      const newLayoutId = `${itemData.id}-${Date.now()}`;

      // Add to grid
      setGridItems(prev => [...prev, { ...itemData, layoutId: newLayoutId }]);

      // Update Layout
      // The `layout` param passed to onDrop contains the new item with the calculated position
      // We just need to ensure the ID matches and force correct settings
      const newLayoutItem = {
        ...layoutItem,
        i: newLayoutId,
        isResizable: false, // Disable resizing
      };

      setLayout(prev => [...prev, newLayoutItem]);

    } catch (e) {
      console.error("Failed to parse drop data", e);
    }
  };

  const handleExport = async () => {
    // Export functionality reset for reimplementation
    console.log("Export Logic Cleared");
    alert("Image export logic has been reset. Ready for new implementation.");
  };

  if (!mounted) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading...</div>;

  return (
    <main className="flex h-screen flex-col bg-stone-950 text-stone-200 overflow-hidden font-sans selection:bg-orange-500/30 relative">
      {/* Header */}
      {/* Header */}
      <header className="h-16 px-6 bg-stone-900/80 backdrop-blur-md border-b border-stone-800 flex justify-between items-center z-50 shadow-lg shrink-0 relative">
        {/* Left: Logo Placeholder */}
        <div className="flex items-center justify-center w-[88px] h-14 bg-stone-800 rounded-md border border-stone-700 overflow-hidden shrink-0 hover:border-stone-500 transition-colors cursor-pointer relative">
          <span className="text-[10px] text-stone-500 font-bold">550x350</span>
        </div>

        {/* Center: Theme Title (No Gradient, Clean) */}
        <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-bold text-stone-100 tracking-wide">
          {themeTitle}
        </h1>

        {/* Right: Export Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-white text-stone-900 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            <Download size={16} />
            Save Image
          </button>
        </div>
      </header>

      {/* Main Content - Grid Area */}
      <div
        className="flex-1 relative overflow-auto bg-stone-950 cursor-grab active:cursor-grabbing scrollbar-hide"
        ref={gridContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Hide Scrollbar
      >
        <div className="flex items-center justify-center min-w-full min-h-full transition-all duration-200"
          style={{
            // Ensure container grows to fit zoomed content so scrolling works
            width: zoomLevel > 1 ? `${1000 * zoomLevel}px` : '100%',
            height: zoomLevel > 1 ? `${1000 * zoomLevel}px` : '100%'
          }}
        >
          <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}>
            <AnimeGrid
              items={gridItems}
              layout={layout}
              onLayoutChange={handleLayoutChange}
              onRemoveItem={handleRemoveItem}
              axisLabels={axisLabels}
              dockId="anime-dock"
              isDockOpen={isDockOpen}
              scale={zoomLevel} // Pass scale for RGL
              onDrop={handleDrop}
              droppingItem={{ i: '__dropping-elem__', w: DROP_SIZE.w, h: DROP_SIZE.h }}
            />
          </div>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="fixed top-24 right-8 flex flex-col gap-2 z-50">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-stone-800 text-stone-200 rounded-full shadow-lg hover:bg-stone-700 active:scale-95 transition-all border border-stone-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={zoomLevel >= 1.5}
        >
          <Plus size={20} />
        </button>
        <div className="bg-stone-900/80 text-stone-400 text-xs font-bold py-1 px-2 rounded text-center backdrop-blur-md border border-stone-800 select-none">
          {Math.round(zoomLevel * 100)}%
        </div>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-stone-800 text-stone-200 rounded-full shadow-lg hover:bg-stone-700 active:scale-95 transition-all border border-stone-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={zoomLevel <= 0.7}
        >
          <Minus size={20} />
        </button>


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
