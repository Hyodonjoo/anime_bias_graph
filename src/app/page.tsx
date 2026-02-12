'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '@/types/layout';
import AnimeGrid from '@/components/AnimeGrid';
import AnimeDock from '@/components/AnimeDock';
import { AnimeItem } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';
import { ChevronUp, ChevronDown, Download, Plus, Minus, Eye, EyeOff } from 'lucide-react';
import { toCanvas } from 'html-to-image';
import { resolveLayout } from '@/lib/gridUtils';

export default function Home() {
  const [themeTitle, setThemeTitle] = useState('');
  const [axisLabels, setAxisLabels] = useState({ top: '', bottom: '', left: '', right: '' });
  const [showAxisLabels, setShowAxisLabels] = useState(true);
  const [dockItems, setDockItems] = useState<AnimeItem[]>([]);
  const [gridItems, setGridItems] = useState<(AnimeItem & { layoutId: string })[]>([]);
  const [isDockOpen, setIsDockOpen] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%



  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.7));

  // Fixed layout state instead of responsive breakpoints
  const [layout, setLayout] = useState<Layout[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isItemDragging, setIsItemDragging] = useState(false);
  const [themeId, setThemeId] = useState<string | null>(null);

  // Drag to Scroll Refs
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const startMouseRef = useRef({ x: 0, y: 0 });
  const startPanRef = useRef({ x: 0, y: 0 });

  // Mobile Dock Dragging State
  const [draggingDockItem, setDraggingDockItem] = useState<AnimeItem | null>(null);
  const [dragOverlayPos, setDragOverlayPos] = useState({ x: 0, y: 0 });
  const dragItemRef = useRef<AnimeItem | null>(null); // Ref for event handlers to access current item without closure issues

  const GRID_SIZE = 1000;

  // Helper to clamp pan values based on zoom and container size
  const getClampedPan = (x: number, y: number, scale: number) => {
    if (!gridContainerRef.current) return { x: 0, y: 0 };

    const container = gridContainerRef.current;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const scaledGridW = GRID_SIZE * scale;
    const scaledGridH = GRID_SIZE * scale;

    let maxPanX = 0;
    let maxPanY = 0;

    // Use a small threshold for "1.0" to handle potential float precision issues (1.0 vs 1.0000001)
    if (scale < 1.01) {
      // Strict Mode: When zoomed out or at 100%, lock strictly to center unless content overflows
      // This prevents "moving screen when shrunk"
      maxPanX = scaledGridW > containerW ? (scaledGridW - containerW) / 2 : 0;
      maxPanY = scaledGridH > containerH ? (scaledGridH - containerH) / 2 : 0;
    } else {
      // Zoomed Mode: Allow panning to ensure edges are accessible
      // Increase BUFFER to 500 to allow pulling edges well into the screen even at 150%
      const overflowX = Math.max(0, (scaledGridW - containerW) / 2);
      const overflowY = Math.max(0, (scaledGridH - containerH) / 2);

      const BUFFER = 500;
      maxPanX = overflowX + BUFFER;
      maxPanY = overflowY + BUFFER;
    }

    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, y))
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if we clicked on a card or associated UI (resize handle, button, etc)
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

  // Touch Panning Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    // Ignore if touching a card or interactive element (or if we are dragging a dock item)
    if ((e.target as HTMLElement).closest('.anime-grid-card') || (e.target as HTMLElement).closest('.react-resizable-handle') || draggingDockItem) return;

    // We only care about single touch for panning
    if (e.touches.length === 1) {
      isPanningRef.current = true;
      startMouseRef.current = { x: e.touches[0].pageX, y: e.touches[0].pageY };
      startPanRef.current = { x: pan.x, y: pan.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPanningRef.current || e.touches.length !== 1) return;
    // e.preventDefault(); // handled by style touch-action usually, or allow scroll if vertical? 
    // Actually we want to PAN the grid, so we want to generic scroll? 
    // The grid is overflow-hidden, so native scroll is disabled. We implement custom pan.

    const deltaX = e.touches[0].pageX - startMouseRef.current.x;
    const deltaY = e.touches[0].pageY - startMouseRef.current.y;

    const rawX = startPanRef.current.x + deltaX;
    const rawY = startPanRef.current.y + deltaY;

    setPan(getClampedPan(rawX, rawY, zoomLevel));
  };

  const handleTouchEnd = () => {
    isPanningRef.current = false;
  };

  // Mobile Dock Drag Handlers
  const handleDockItemTouchStart = (item: AnimeItem, e: React.TouchEvent) => {
    // Prevent default to stop scrolling/refresh etc
    // e.preventDefault(); // React event cannot be prevented async, but we can try? 
    // Actually, better to just set state.

    dragItemRef.current = item;
    setDraggingDockItem(item);
    setDragOverlayPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });

    // Add global listeners for the move/end phase
    window.addEventListener('touchmove', handleDockItemTouchMove, { passive: false });
    window.addEventListener('touchend', handleDockItemTouchEnd);
  };

  const handleDockItemTouchMove = (e: TouchEvent) => {
    e.preventDefault(); // Critical to stop scrolling while dragging
    if (e.touches.length > 0) {
      setDragOverlayPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleDockItemTouchEnd = (e: TouchEvent) => {
    // Remove listeners
    window.removeEventListener('touchmove', handleDockItemTouchMove);
    window.removeEventListener('touchend', handleDockItemTouchEnd);

    const item = dragItemRef.current;
    setDraggingDockItem(null);
    dragItemRef.current = null;

    if (!item || !gridContainerRef.current) return;

    const touch = e.changedTouches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    const gridRect = gridContainerRef.current.getBoundingClientRect();

    // Check if dropped inside grid container
    if (
      clientX >= gridRect.left &&
      clientX <= gridRect.right &&
      clientY >= gridRect.top &&
      clientY <= gridRect.bottom
    ) {
      // Calculate conversion to Grid Coordinates
      // Formula: GridCenter + (ScreenPos - ScreenCenter - Pan) / Zoom
      const screenCenterX = gridRect.width / 2;
      const screenCenterY = gridRect.height / 2;

      const gridCenterX = GRID_SIZE / 2; // 500
      const gridCenterY = GRID_SIZE / 2; // 500

      // Delta from screen center
      const deltaX = clientX - gridRect.left - screenCenterX;
      const deltaY = clientY - gridRect.top - screenCenterY;

      // Apply zoom & pan to get grid-relative coordinates
      const x = gridCenterX + (deltaX - pan.x) / zoomLevel;
      const y = gridCenterY + (deltaY - pan.y) / zoomLevel;

      // Logic to add item
      const newLayoutId = `${item.id}-${Date.now()}`;
      const newItem = { ...item, layoutId: newLayoutId };

      // New Grid Item
      const gridItemParams: Layout = {
        i: newLayoutId,
        x: Math.max(0, x - 50), // Center
        y: Math.max(0, y - 50),
        w: 100,
        h: 100,
        isResizable: false
      };

      // Update State
      setDockItems(prev => prev.filter(i => i.id !== item.id));
      setGridItems(prev => [...prev, newItem]);

      // We need to resolve layout collision.
      // We can't easily access the LATEST 'layout' state inside this closure if it changed.
      // But layout connects to state.
      // Instead of using 'layout' directly (which might be stale), we should probably trust it hasn't changed much?
      // Or use a ref for layout? 
      // For now, assume single user interaction.

      setLayout(prevLayout => {
        return resolveLayout([...prevLayout, gridItemParams], gridItemParams);
      });
    }
  };

  // Re-clamp pan when zoom changes (keep grid within bounds)
  useEffect(() => {
    setPan(prev => getClampedPan(prev.x, prev.y, zoomLevel));
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
    setLayout(newLayout);
  };

  const handleRemoveItem = (id: string) => {
    const itemToRemove = gridItems.find(i => i.layoutId === id);
    if (!itemToRemove) return;

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
      setDockItems(prev => prev.filter(i => i.id !== itemData.id));

      const newLayoutId = `${itemData.id}-${Date.now()}`;

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
      const SIDE_PADDING = 20; // Minimal padding for labels/numbers at edges
      const BOTTOM_PADDING = 20; // Minimal padding for bottom label/number

      const WIDTH = GRID_SIZE + (SIDE_PADDING * 2);
      const HEIGHT = GRID_SIZE + HEADER_HEIGHT + BOTTOM_PADDING;

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
      // Center the grid in the canvas
      const gridOriginX = SIDE_PADDING;
      const gridOriginY = HEADER_HEIGHT;

      ctx.translate(gridOriginX, gridOriginY);

      // --- START CLIPPED REGION (Grid Content Only) ---
      // We clip everything to the grid area now, including labels if they were outside (but now they are inside)
      // Actually, if we want labels INSIDE, we don't strictly need to clip them out, but standard grid clip is fine.
      ctx.save();

      ctx.beginPath();
      // Allow drawing slightly outside grid (e.g. for numbers) by not strict clipping?
      // No, user wants specifically the numbers at the edges to show. Those are drawn INSIDE the loop at pos=0 or pos=1000.
      // Text drawing might bleed slightly. Let's expand clip slightly or just clip strictly to grid?
      // User said "little bit of room".
      // Let's clip to GRID_SIZE but usually text rendering *at* 0 might get cut if left-aligned.
      // The numbers are centered. '100' at x=1000 will extend to x=1010.
      // So we should expand the clip rect slightly.
      ctx.rect(-20, -20, GRID_SIZE + 40, GRID_SIZE + 40); // Expand clip logic
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

      // 5. Draw Anime Items
      const imageLoadPromises = gridItems.map(async (item) => {
        const layoutItem = layout.find(l => l.i === item.layoutId);
        if (!layoutItem) return;

        const img = new Image();
        img.crossOrigin = 'anonymous'; // Crucial for CORS
        img.src = item.imageUrl;

        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = () => {
            console.warn(`Failed to load image for ${item.title}`);
            resolve(null);
          };
        });

        return { img, x: layoutItem.x, y: layoutItem.y, title: item.title, tag: item.tag };
      });

      const loadedImages = await Promise.all(imageLoadPromises);
      // Draw images in order
      loadedImages.forEach(data => {
        if (!data) return;
        const { img, x, y, tag } = data;
        const ITEM_SIZE = 100; // 100px fixed (5x5 grids)

        // Draw Image with object-fit: cover behavior
        try {
          // Calculate aspect ratio
          const imgRatio = img.width / img.height;
          const targetRatio = 1; // Square 100x100

          let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

          if (imgRatio > targetRatio) {
            // Image is wider than target: Crop width (center)
            sHeight = img.height;
            sWidth = sHeight * targetRatio;
            sx = (img.width - sWidth) / 2;
            sy = 0;
          } else {
            // Image is taller than target: Crop height (center)
            sWidth = img.width;
            sHeight = sWidth / targetRatio;
            sx = 0;
            sy = (img.height - sHeight) / 2;
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, ITEM_SIZE, ITEM_SIZE);
        } catch (e) {
          ctx.fillStyle = '#333';
          ctx.fillRect(x, y, ITEM_SIZE, ITEM_SIZE);
        }

        // Border
        ctx.strokeStyle = '#374151'; // gray-700
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, ITEM_SIZE, ITEM_SIZE);

        // Draw Tag if exists
        if (tag) {
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const textWidth = ctx.measureText(tag).width;
          const padding = 4;
          const tagX = x + ITEM_SIZE / 2;
          const tagY = y + ITEM_SIZE - 5; // Slightly overlapping bottom

          // Tag Background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(tagX - textWidth / 2 - padding, tagY, textWidth + padding * 2, 18);

          // Tag Text
          ctx.fillStyle = '#ffffff';
          ctx.fillText(tag, tagX, tagY + 2);
        }
      });

      ctx.restore();
      // --- END CLIPPED REGION ---

      // 6. Draw Axis Lines (Blue Center Lines)
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.8)'; // blue-400/80
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(96, 165, 250, 0.5)';
      ctx.shadowBlur = 10;

      // Vertical Axis (Y-Axis Line)
      ctx.beginPath();
      ctx.moveTo(GRID_SIZE / 2, 0);
      ctx.lineTo(GRID_SIZE / 2, GRID_SIZE);
      ctx.stroke();

      // Horizontal Axis (X-Axis Line)
      ctx.beginPath();
      ctx.moveTo(0, GRID_SIZE / 2);
      ctx.lineTo(GRID_SIZE, GRID_SIZE / 2);
      ctx.stroke();

      ctx.shadowColor = 'transparent';

      // 6.5 Draw Ticks and Grid Numbers (10-unit intervals)
      ctx.fillStyle = 'rgba(147, 197, 253, 0.8)'; // blue-300/80 text
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)'; // blue-400/60 line
      ctx.lineWidth = 1;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i <= 20; i++) {
        const value = -100 + (i * 10);
        if (value === 0) continue; // Skip center 0

        // Calculate Position on Grid (0 to 1000)
        // i goes 0..20. i=10 is center.
        // pos = (i / 20) * GRID_SIZE
        const pos = (i / 20) * GRID_SIZE;
        const center = GRID_SIZE / 2;

        // --- X-Axis Ticks (Vertical marks on horizontal line) ---
        // x = pos, y = center
        ctx.beginPath();
        ctx.moveTo(pos, center - 6);
        ctx.lineTo(pos, center + 6);
        ctx.stroke();

        // X-Axis Number (Below)
        ctx.fillText(Math.abs(value).toString(), pos, center + 16);

        // --- Y-Axis Ticks (Horizontal marks on vertical line) ---
        // x = center, y = pos (Note: top is -100? No, usually top is Y-. Check CSS logic)
        // In CSS: topPercent = 50 - (value / 2). 
        // If val=100, top=0. So top is POSITIVE Y? No, top of screen is Y=0.
        // Wait, "Theme" usually implies Top is Good/High? Or Top is Y+?
        // Let's look at `AnimeGrid.tsx`:
        // value = -100..+100.
        // topPercent = 50 - (value / 2). if val=100 -> 0%. Top.
        // topPercent = 50 - (-100 / 2) -> 100%. Bottom.
        // So +100 is at Top (y=0). -100 is at Bottom (y=1000).
        // My loop `pos` goes 0..1000. 
        // i=0 -> val=-100. pos=0. This means -100 is at TOP? 
        // NO. `(i/20)*GRID_SIZE` means i=0 is 0px (Top).
        // But logic says -100 is Bottom.
        // So for Y axis, we need to invert or map correctly.

        // Let's use the explicit math from CSS:
        // topPercent = 50 - (value / 2).
        // yPos = (topPercent / 100) * GRID_SIZE
        const yPosIdx = (50 - (value / 2)) / 100 * GRID_SIZE;

        ctx.beginPath();
        ctx.moveTo(center - 6, yPosIdx);
        ctx.lineTo(center + 6, yPosIdx);
        ctx.stroke();

        // Y-Axis Number (Right)
        ctx.textAlign = 'left';
        ctx.fillText(Math.abs(value).toString(), center + 12, yPosIdx);
        ctx.textAlign = 'center'; // Reset
      }

      // 7. Draw Axis Labels (Inside Grid)
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
        ctx.lineWidth = 1;

        // Pill Shape
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x - width / 2, y - height / 2, width, height, 14);
        } else {
          // Fallback for older browsers
          ctx.rect(x - width / 2, y - height / 2, width, height);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#9ca3af'; // gray-400
        ctx.fillText(text, x, y);
      };

      // Top (Inside, Top Center)
      drawLabel(`${axisLabels.top} ▲`, GRID_SIZE / 2, 30);
      // Bottom (Inside, Bottom Center)
      drawLabel(`▼ ${axisLabels.bottom}`, GRID_SIZE / 2, GRID_SIZE - 30);
      // Left (Inside, Left Center, avoiding axis line)
      drawLabel(`◀ ${axisLabels.left}`, 80, GRID_SIZE / 2 - 30);

      // Right (Inside, Right Center, avoiding axis line)
      drawLabel(`${axisLabels.right} ▶`, GRID_SIZE - 80, GRID_SIZE / 2 - 30);

      // 8. Export with Scaling
      // Create a temporary canvas for scaling
      const outputCanvas = document.createElement('canvas');
      const outputCtx = outputCanvas.getContext('2d');

      if (!outputCtx) {
        // Fallback to original size if context fails
        const dataUrl = canvas.toDataURL('image/webp', 1.0);
        const link = document.createElement('a');
        link.download = `${themeTitle ? themeTitle.replace(/\s+/g, '_') : 'anime_bias_grid'}.webp`;
        link.href = dataUrl;
        link.click();
        return;
      }

      // Target Width: 800px
      // Calculate Scale Factor
      const TARGET_WIDTH = 800;
      const scaleFactor = TARGET_WIDTH / WIDTH;
      const TARGET_HEIGHT = HEIGHT * scaleFactor;

      outputCanvas.width = TARGET_WIDTH;
      outputCanvas.height = TARGET_HEIGHT;

      // Draw original canvas onto scaled canvas
      // Use high quality image smoothing
      outputCtx.imageSmoothingEnabled = true;
      outputCtx.imageSmoothingQuality = 'high';
      outputCtx.drawImage(canvas, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      const dataUrl = outputCanvas.toDataURL('image/webp', 0.95); // High quality WebP
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
    <main className="flex h-[100dvh] flex-col bg-stone-950 text-stone-200 overflow-hidden font-sans selection:bg-orange-500/30 relative">
      {/* Header */}
      <header className="h-16 bg-stone-900/80 backdrop-blur-md border-b border-stone-800 z-50 shadow-lg shrink-0 relative">
        {/* Left: Logo Placeholder - Hidden on mobile */}
        {/* Left: Logo Placeholder - Hidden on mobile */}
        <div className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 items-center justify-center w-[88px] h-14 bg-stone-800 rounded-md border border-stone-700 overflow-hidden shrink-0 hover:border-stone-500 transition-colors cursor-pointer">
          <span className="text-[10px] text-stone-500 font-bold">550x350</span>
        </div>

        {/* Center: Theme Title (No Gradient, Clean) */}
        <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg md:text-xl font-bold text-stone-100 tracking-wide whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] md:max-w-none">
          {themeTitle}
        </h1>

        {/* Right: Export Button */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
          <button
            onClick={() => setShowAxisLabels(!showAxisLabels)}
            className="flex items-center gap-2 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-sm font-bold shadow-md transition-all active:scale-95 border border-stone-700"
            title={showAxisLabels ? "Hide Axis Labels" : "Show Axis Labels"}
          >
            {showAxisLabels ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-stone-100 hover:bg-white text-stone-900 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            <Download size={16} />
            <span className="hidden md:inline">Save Image</span>
          </button>
        </div>
      </header>

      {/* Main Content - Grid Area */}
      <div
        className={`flex-1 relative bg-stone-950 cursor-grab active:cursor-grabbing scrollbar-hide touch-none ${isItemDragging ? 'overflow-hidden' : 'overflow-hidden'}`} // Force hidden on container
        ref={gridContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        // Touch Handlers
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Hide Scrollbar
      >
        <div className="absolute inset-0 flex items-center justify-center">
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
            showAxisLabels={showAxisLabels}
          />
        </div>
      </div>

      {/* Sticky Axis Labels (Top, Left, Right) */}
      {showAxisLabels && (
        <>
          {/* Top */}
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
            <span className="font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm whitespace-nowrap">
              {axisLabels.top} ▲
            </span>
          </div>

          {/* Left */}
          <div className="fixed left-4 top-1/2 -translate-y-1/2 z-40 pointer-events-none">
            <span className="block font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-2xl md:rounded-full border border-gray-700 shadow-lg backdrop-blur-sm max-w-[80px] md:max-w-none text-center whitespace-normal md:whitespace-nowrap leading-tight">
              ◀ {axisLabels.left}
            </span>
          </div>

          {/* Right */}
          <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 pointer-events-none">
            <span className="block font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-2xl md:rounded-full border border-gray-700 shadow-lg backdrop-blur-sm max-w-[80px] md:max-w-none text-center whitespace-normal md:whitespace-nowrap leading-tight">
              {axisLabels.right} ▶
            </span>
          </div>
        </>
      )}

      {/* Bottom Axis Label - Sticky to Screen */}
      {showAxisLabels && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all duration-500 ease-in-out"
          style={{ bottom: isDockOpen ? '220px' : '24px' }}
        >
          <span className="font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm whitespace-nowrap">
            ▼ {axisLabels.bottom}
          </span>
        </div>
      )}

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
          <AnimeDock items={dockItems} onDragStartMobile={handleDockItemTouchStart} />
        </div>
      </div>

      {/* Mobile Drag Overlay */}
      {draggingDockItem && (
        <div
          className="fixed pointer-events-none z-[100] w-20 h-20 rounded-lg overflow-hidden border-2 border-blue-500 shadow-xl opacity-80"
          style={{
            left: dragOverlayPos.x,
            top: dragOverlayPos.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <img src={draggingDockItem.imageUrl} className="w-full h-full object-cover" alt="dragging" />
        </div>
      )}
    </main>
  );
}
