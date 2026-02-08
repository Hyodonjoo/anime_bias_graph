'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '@/types/layout';
import AnimeGrid from '@/components/AnimeGrid';
import AnimeDock from '@/components/AnimeDock';
import { AnimeItem } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';
import { ChevronUp, ChevronDown, Download, Plus, Minus } from 'lucide-react';
import { toCanvas } from 'html-to-image';

export default function Home() {
  const [themeTitle, setThemeTitle] = useState('');
  const [axisLabels, setAxisLabels] = useState({ top: '', bottom: '', left: '', right: '' });
  const [dockItems, setDockItems] = useState<AnimeItem[]>([]);
  const [gridItems, setGridItems] = useState<(AnimeItem & { layoutId: string })[]>([]);
  const [isDockOpen, setIsDockOpen] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%



  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.7));

  // Fixed layout state instead of responsive breakpoints
  const [layout, setLayout] = useState<Layout[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isItemDragging, setIsItemDragging] = useState(false); // Add dragging state
  const [themeId, setThemeId] = useState<string | null>(null); // Track Theme ID for saving

  // Drag to Scroll Refs
  const gridContainerRef = useRef<HTMLDivElement>(null);
  // ... (rest of refs)

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const startMouseRef = useRef({ x: 0, y: 0 });
  const startPanRef = useRef({ x: 0, y: 0 });

  const GRID_SIZE = 1000;

  // Helper to clamp pan values based on zoom and container size
  const getClampedPan = (x: number, y: number, scale: number) => {
    if (!gridContainerRef.current) return { x: 0, y: 0 };

    const container = gridContainerRef.current;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const scaledGridW = GRID_SIZE * scale;
    const scaledGridH = GRID_SIZE * scale;

    // If grid is smaller than container, allow panning so edges can be brought to center/view
    // Strict clamp prevents seeing 70-100 if they are off-center or clipped.
    // User wants "Show 100", meaning we might need to drag the grid even if it "fits" technically centered.
    // BUT user said "No outside coordinates to show".
    // The issue is likely that "Fit" means centered, and edges are clipped if container is small?
    // OR if zoomed in, edges are off screen.

    // Let's try "Max Pan = (Grid Size / 2) - (Container Size / 2)"
    // If Result > 0, normal pan.
    // If Result < 0 (Grid smaller), this formula usually yields 0 clamp.
    // BUT perhaps user wants to move small grid inside big container? 
    // "No outside" usually means clamping to edges.

    // Re-reading: "Strict doesn't allow 70-100, Relaxed goes outside."
    // This implies the grid IS bigger than view (or parts are hidden), but the clamp is too tight.
    // Or the "1000px" logical size doesn't match visual.

    // Let's try calculating max pan based on the premise that we want to be able to touch the edges to the viewport edges.
    // Max Offset = (ScaledGrid / 2) - (Viewport / 2)
    // If ScaledGrid > Viewport, this is correct for filling.
    // If ScaledGrid < Viewport, this would be negative (fail).

    // Actually, if user can't see 70-100, it means ScaledGrid > Viewport ?? 
    // Or maybe the buffer is needed.
    // Let's force allow panning to edges even if smaller, bounded by the grid edge itself touching center?

    // Compromise: Allow panning up to (ScaledGrid/2) which is the edge from center.
    // MINUS (Container/2) to stop when edge hits container edge.
    // Basically: Math.abs( (ScaledGridW - ContainerW) / 2 )

    // Wait, if 70-100 is not visible, it means it's off-screen.
    // Let's use the standard "Overflow" logic but ensure we calculate Scaled properly.

    const maxPanX = Math.abs((scaledGridW - containerW) / 2);
    const maxPanY = Math.abs((scaledGridH - containerH) / 2);

    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, y))
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if we clicked on a card or associated UI (resize handle, button, etc)
    // If so, do NOT start panning the grid.
    if ((e.target as HTMLElement).closest('.anime-grid-card') || (e.target as HTMLElement).closest('.react-resizable-handle')) return;

    isPanningRef.current = true;
    startMouseRef.current = { x: e.pageX, y: e.pageY };
    startPanRef.current = { x: pan.x, y: pan.y };

    if (gridContainerRef.current) {
      gridContainerRef.current.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    e.preventDefault();

    // Calculate delta
    const deltaX = e.pageX - startMouseRef.current.x;
    const deltaY = e.pageY - startMouseRef.current.y;

    // Update pan based on start position + delta
    const rawX = startPanRef.current.x + deltaX;
    const rawY = startPanRef.current.y + deltaY;

    setPan(getClampedPan(rawX, rawY, zoomLevel));
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    if (gridContainerRef.current) {
      gridContainerRef.current.style.cursor = 'grab';
    }
  };

  // Re-clamp pan when zoom changes (keep grid within bounds)
  useEffect(() => {
    setPan(prev => getClampedPan(prev.x, prev.y, zoomLevel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomLevel]);


  useEffect(() => {
    setMounted(true);
    fetchActiveTheme();
  }, []);

  // Auto-save to LocalStorage whenever state changes
  useEffect(() => {
    if (!mounted || !themeId) return;

    const saveData = {
      gridItems,
      layout,
      dockItems
    };

    localStorage.setItem(`animebias_save_${themeId}`, JSON.stringify(saveData));
  }, [gridItems, layout, dockItems, themeId, mounted]);


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

      setThemeId(themes.id);
      setThemeTitle(themes.title);
      setAxisLabels({
        top: themes.axis_top,
        bottom: themes.axis_bottom,
        left: themes.axis_left,
        right: themes.axis_right
      });

      // Check for local save first
      const saveKey = `animebias_save_${themes.id}`;
      const savedDataString = localStorage.getItem(saveKey);

      if (savedDataString) {
        try {
          const savedData = JSON.parse(savedDataString);
          if (savedData.gridItems && savedData.layout && savedData.dockItems) {
            console.log("Loaded state from LocalStorage");
            setGridItems(savedData.gridItems);
            setLayout(savedData.layout);
            setDockItems(savedData.dockItems);
            return; // Skip DB fetch if local save exists
          }
        } catch (e) {
          console.error("Failed to parse local save, falling back to DB", e);
        }
      }

      // If no save, Fetch anime items for this theme from DB
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

    // Remove the tag when returning to dock
    const { tag, ...cleanedItem } = itemToRemove;

    setGridItems(prev => prev.filter(i => i.layoutId !== id));
    setDockItems(prev => [...prev, cleanedItem]);
    setLayout(prev => prev.filter(l => (l as any).i !== id));
  };

  const handleUpdateTag = (layoutId: string, tag: string) => {
    setGridItems(prev => prev.map(item =>
      item.layoutId === layoutId ? { ...item, tag } : item
    ));
  };

  const handleDrop = (resolvedLayout: Layout[], layoutItem: Layout, _event: Event) => {
    const event = _event as DragEvent;
    const data = event.dataTransfer?.getData("application/json");
    if (!data) return;

    try {
      const itemData = JSON.parse(data);
      // Remove from dock
      setDockItems(prev => prev.filter(i => i.id !== itemData.id));

      const newLayoutId = `${itemData.id}-${Date.now()}`;

      // Add to grid items
      setGridItems(prev => [...prev, { ...itemData, layoutId: newLayoutId }]);

      // Update Layout with the RESOLVED positions from AnimeGrid
      // We need to find the Item with temp ID and replace it with real ID
      const finalLayout = resolvedLayout.map(l => {
        if (l.i === '__dropping_elem__') {
          return { ...l, i: newLayoutId, isResizable: false };
        }
        return l;
      });

      setLayout(finalLayout);

    } catch (e) {
      console.error("Failed to parse drop data", e);
    }
  };

  const handleExport = async () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Canvas Settings
      const GRID_SIZE = 1000;
      const HEADER_HEIGHT = 150;
      const WIDTH = 1000;
      const HEIGHT = GRID_SIZE + HEADER_HEIGHT; // 1150px

      canvas.width = WIDTH;
      canvas.height = HEIGHT;

      // 1. Background
      ctx.fillStyle = '#0c0a09'; // stone-950
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // 2. Title
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Add subtle text shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fillText((themeTitle || 'ANIME GRID').toUpperCase(), WIDTH / 2, HEADER_HEIGHT / 2);
      ctx.shadowColor = 'transparent'; // Reset shadow

      // 3. Grid Area Offset
      ctx.translate(0, HEADER_HEIGHT);

      // Clip to grid area for safety
      ctx.beginPath();
      ctx.rect(0, 0, GRID_SIZE, GRID_SIZE);
      ctx.clip();

      // 4. Draw Grid Lines (Background visual)
      ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)'; // gray-600/30
      ctx.lineWidth = 1;

      const CELL_SIZE = 20;

      for (let i = 0; i <= GRID_SIZE; i += CELL_SIZE) {
        // Vertical
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, GRID_SIZE);
        ctx.stroke();

        // Horizontal
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(GRID_SIZE, i);
        ctx.stroke();
      }

      // 5. Draw Axis Lines (Blue Center Lines)
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.8)'; // blue-400/80
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(96, 165, 250, 0.5)';
      ctx.shadowBlur = 10;

      // Vertical Axis
      ctx.beginPath();
      ctx.moveTo(GRID_SIZE / 2, 0);
      ctx.lineTo(GRID_SIZE / 2, GRID_SIZE);
      ctx.stroke();

      // Horizontal Axis
      ctx.beginPath();
      ctx.moveTo(0, GRID_SIZE / 2);
      ctx.lineTo(GRID_SIZE, GRID_SIZE / 2);
      ctx.stroke();

      ctx.shadowColor = 'transparent';

      // 6. Draw Anime Items
      // We need to load images first.
      const imageLoadPromises = gridItems.map(async (item) => {
        const layoutItem = layout.find(l => l.i === item.layoutId);
        if (!layoutItem) return;

        const img = new Image();
        img.crossOrigin = 'anonymous'; // Crucial for CORS
        img.src = item.imageUrl;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => {
            console.warn(`Failed to load image for ${item.title}`);
            resolve(null); // Resolve anyway to continue
          };
        });

        return { img, x: layoutItem.x, y: layoutItem.y, title: item.title, tag: item.tag };
      });

      const loadedImages = await Promise.all(imageLoadPromises);

      // Draw images in order
      loadedImages.forEach(data => {
        if (!data) return;
        const { img, x, y, tag } = data;
        const ITEM_SIZE = 60; // 60px fixed

        // Save context for clipping rounded corners (if any) - currently square in design
        // But let's add a small border/shadow like the CSS

        // Shadow/Glow
        // ctx.shadowColor = 'rgba(0,0,0,0.5)';
        // ctx.shadowBlur = 4;
        // ctx.fillRect(x, y, ITEM_SIZE, ITEM_SIZE);
        // ctx.shadowColor = 'transparent';

        // Draw Image
        try {
          ctx.drawImage(img, x, y, ITEM_SIZE, ITEM_SIZE);
        } catch (e) {
          // Fallback color if image fails to draw (rare if onload passed)
          ctx.fillStyle = '#333';
          ctx.fillRect(x, y, ITEM_SIZE, ITEM_SIZE);
        }

        // Border
        ctx.strokeStyle = '#374151'; // gray-700
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, ITEM_SIZE, ITEM_SIZE);

        // Draw Tag if exists
        if (tag) {
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const textWidth = ctx.measureText(tag).width;
          const padding = 4;
          const tagX = x + ITEM_SIZE / 2;
          const tagY = y + ITEM_SIZE - 5; // Slightly overlapping bottom

          // Tag Background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          // Round rect approx
          ctx.fillRect(tagX - textWidth / 2 - padding, tagY, textWidth + padding * 2, 14);

          // Tag Text
          ctx.fillStyle = '#ffffff';
          ctx.fillText(tag, tagX, tagY + 2);
        }
      });

      // 7. Draw Axis Labels (Top, Bottom, Left, Right)
      // Reset Shadow
      ctx.shadowColor = 'transparent';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Helper to draw label pill
      const drawLabel = (text: string, x: number, y: number) => {
        if (!text) return;
        const width = ctx.measureText(text).width + 24;
        const height = 28;

        // Pill Background
        ctx.fillStyle = 'rgba(17, 24, 39, 0.9)'; // gray-900/90
        ctx.strokeStyle = '#374151'; // gray-700

        // Pill Shape
        ctx.beginPath();
        ctx.roundRect(x - width / 2, y - height / 2, width, height, 14);
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.fillStyle = '#9ca3af'; // gray-400
        ctx.fillText(text, x, y);
      };

      // Top
      drawLabel(`${axisLabels.top} ▲`, GRID_SIZE / 2, 20);
      // Bottom
      drawLabel(`▼ ${axisLabels.bottom}`, GRID_SIZE / 2, GRID_SIZE - 20);
      // Left
      drawLabel(`◀ ${axisLabels.left}`, 60, GRID_SIZE / 2); // approximate nice position
      // Right
      drawLabel(`${axisLabels.right} ▶`, GRID_SIZE - 60, GRID_SIZE / 2);

      // 8. Export
      const dataUrl = canvas.toDataURL('image/webp', 1.0);
      const link = document.createElement('a');
      link.download = `${themeTitle ? themeTitle.replace(/\s+/g, '_') : 'anime_bias_grid'}.webp`;
      link.href = dataUrl;
      link.click();

    } catch (err) {
      console.error('Export failed:', err);
      alert('이미지 저장 중 오류가 발생했습니다.');
    }
  };

  if (!mounted) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading...</div>;

  return (
    <main className="flex h-screen flex-col bg-stone-950 text-stone-200 overflow-hidden font-sans selection:bg-orange-500/30 relative">
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
        className={`flex-1 relative bg-stone-950 cursor-grab active:cursor-grabbing scrollbar-hide ${isItemDragging ? 'overflow-hidden' : 'overflow-hidden'}`} // Force hidden on container
        ref={gridContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Hide Scrollbar
      >
        <div className="flex items-center justify-center min-w-full min-h-full">
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
            onDragStateChange={setIsItemDragging}
            onUpdateTag={handleUpdateTag}
            offset={pan}
          />
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
        {/* Toggle Handle - Moved to Right (Offset) and Larger */}
        <button
          onClick={() => setIsDockOpen(!isDockOpen)}
          className="absolute -top-10 right-8 h-10 px-6 bg-gray-800/90 hover:bg-gray-700 backdrop-blur-md border border-gray-600/50 rounded-lg flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-all shadow-[0_-5px_15px_rgba(0,0,0,0.3)] group z-50"
        >
          {isDockOpen ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
        </button>

        {/* Dock Content */}
        <div className="w-full h-full bg-gray-900/90 backdrop-blur-2xl border border-gray-700/50 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/10">
          <AnimeDock items={dockItems} />
        </div>
      </div>
    </main>
  );
}
