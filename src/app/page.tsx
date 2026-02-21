'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '@/types/layout';
import AnimeGrid from '@/components/AnimeGrid';
import AnimeDock from '@/components/AnimeDock';
import { AnimeItem } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, Minus, Eye, EyeOff } from 'lucide-react';
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
  const [isDataLoaded, setIsDataLoaded] = useState(false);
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
      // Strict Mode: When zoomed out or at 100%
      // X-Axis strict
      maxPanX = scaledGridW > containerW ? (scaledGridW - containerW) / 2 : 10;

      // Y-Axis: Allow buffer (Dock height ~200px + extra) so user can see bottom '100' label.
      // E.g. (Overflow/2) + 10.
      maxPanY = Math.max(0, (scaledGridH - containerH) / 2 + 20);
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
    // Only save if mounted, themeId exists, AND data has finished initial loading
    if (!mounted || !themeId || !isDataLoaded) return;

    const saveData = {
      gridItems,
      layout,
      dockItems
    };

    localStorage.setItem(`animebias_save_${themeId}`, JSON.stringify(saveData));
  }, [gridItems, layout, dockItems, themeId, mounted, isDataLoaded]);


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

      // Clean up old theme saves (delete previous layout info)
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('animebias_save_') && key !== `animebias_save_${themes.id}`) {
            keysToRemove.push(key);
          }
        }
        if (keysToRemove.length > 0) {
          console.log('[Cleanup] Removing old theme saves:', keysToRemove);
          keysToRemove.forEach(key => localStorage.removeItem(key));
        }
      } catch (e) {
        console.warn('Cleanup failed:', e);
      }

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
            setIsDataLoaded(true);
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
      setIsDataLoaded(true);

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

      // Render at a high resolution scale (4x) to maintain ultra crisp image quality (near 4K)
      const SCALE = 4;

      canvas.width = WIDTH * SCALE;
      canvas.height = HEIGHT * SCALE;

      // Native scaled rendering provides ultra-crisp vector shapes, text, and sharp image drawing
      ctx.scale(SCALE, SCALE);

      // Critical for preventing blur/pixelation (aliasing) when drawing anime cover images
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Background
      ctx.fillStyle = '#0c0a09'; // stone-950
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // 2. Premium Title Area
      const titleStr = (themeTitle || 'ANIME GRID').toUpperCase();
      const titleX = WIDTH / 2;
      const titleY = HEADER_HEIGHT / 2;

      // Title Background Glow
      const glowGradient = ctx.createRadialGradient(titleX, titleY, 0, titleX, titleY, 250);
      glowGradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)'); // Subtle blue glow
      glowGradient.addColorStop(1, 'rgba(12, 10, 9, 0)'); // fade out to stone-950
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, WIDTH, HEADER_HEIGHT);

      // 2.5 Left Identity (Logo & Site Name)
      ctx.save();
      const logoStartX = 40; // px from edge
      const logoCenterY = HEADER_HEIGHT / 2;

      // Logo Icon Box - Scaled down by half
      const logoSize = 50;
      const cornerRadius = 10;

      ctx.fillStyle = '#18181b'; // zinc-900 
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;

      // Subdued outer glow for logo
      ctx.shadowColor = 'rgba(37, 99, 235, 0.4)'; // subtle blue
      ctx.shadowBlur = 15;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(logoStartX, logoCenterY - (logoSize / 2), logoSize, logoSize, cornerRadius);
      } else {
        ctx.rect(logoStartX, logoCenterY - (logoSize / 2), logoSize, logoSize);
      }
      ctx.fill();
      ctx.shadowColor = 'transparent'; // reset shadow for stroke & others
      ctx.stroke();

      // Inner Diamond shape
      ctx.save();
      ctx.translate(logoStartX + (logoSize / 2), logoCenterY);
      ctx.rotate(45 * Math.PI / 180);
      const diamondRadius = 10;
      const innerGrad = ctx.createLinearGradient(-diamondRadius, -diamondRadius, diamondRadius, diamondRadius);
      innerGrad.addColorStop(0, '#ffffff');
      innerGrad.addColorStop(1, '#6b7280'); // gray-500
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-diamondRadius, -diamondRadius, diamondRadius * 2, diamondRadius * 2, 2);
      } else {
        ctx.rect(-diamondRadius, -diamondRadius, diamondRadius * 2, diamondRadius * 2);
      }
      ctx.fill();
      ctx.restore();

      // Site Identity Text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const textStartX = logoStartX + logoSize + 12;

      // ANIME BIAS
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#e5e7eb'; // gray-200
      ctx.fillText('ANIME BIAS', textStartX, logoCenterY - 10);

      // COORDINATE GRID
      ctx.font = '500 12px sans-serif';
      ctx.fillStyle = '#6b7280'; // gray-500
      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = '0.2em';
      }
      ctx.fillText('COORDINATE GRID', textStartX, logoCenterY + 10);
      if ('letterSpacing' in ctx) {
        (ctx as any).letterSpacing = '0px'; // reset
      }

      // Vertical Separator
      const textWidth = ctx.measureText('COORDINATE GRID  ').width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(textStartX + textWidth, logoCenterY - 20, 1.5, 40); // was 32px tall

      ctx.restore();

      ctx.save();
      // Restore Original Font settings: solid white, bold, sans-serif
      ctx.font = '800 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';

      // Add subtle dark text shadow from the original
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;

      // Ensure the text aligns slightly up to balance the decorative lines below
      ctx.fillText(titleStr, titleX, titleY - 5);
      ctx.restore();

      // Decorative Energy Lines Below Title
      const decorY = titleY + 30;

      ctx.save();
      // Center Glow Dot
      ctx.shadowColor = 'rgba(59, 130, 246, 0.8)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#60A5FA';
      ctx.beginPath();
      ctx.arc(titleX, decorY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Left Line (Fading to left)
      const lineLeftGrad = ctx.createLinearGradient(titleX - 10, decorY, titleX - 60, decorY);
      lineLeftGrad.addColorStop(0, '#60A5FA');
      lineLeftGrad.addColorStop(1, 'rgba(96, 165, 250, 0)');
      ctx.fillStyle = lineLeftGrad;
      ctx.fillRect(titleX - 60, decorY - 1, 50, 2);

      // Right Line (Fading to right)
      const lineRightGrad = ctx.createLinearGradient(titleX + 10, decorY, titleX + 60, decorY);
      lineRightGrad.addColorStop(0, '#60A5FA');
      lineRightGrad.addColorStop(1, 'rgba(96, 165, 250, 0)');
      ctx.fillStyle = lineRightGrad;
      ctx.fillRect(titleX + 10, decorY - 1, 50, 2);
      ctx.restore();

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

      // 6. Draw Axis Lines (White Center Lines)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; // white/80
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
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

      // Center Origin Dot
      ctx.shadowColor = 'rgba(255, 255, 255, 1)';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(GRID_SIZE / 2, GRID_SIZE / 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';

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

      // 8. Export High-Res Image
      const dataUrl = canvas.toDataURL('image/webp', 1.0); // Export with lossless compression for maximum crispness
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
      {/* Header - Premium Tech / Sleek Aerospace Style */}
      <header className="h-20 bg-zinc-950 border-b border-white/5 z-50 shrink-0 relative overflow-hidden flex items-center justify-between px-8 shadow-2xl">
        {/* Deep Atmosphere Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-zinc-950 to-zinc-950 pointer-events-none"></div>
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50"></div>

        {/* Left: Identity */}
        <div className="flex items-center gap-5 relative z-10 h-full">
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-violet-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
            <div className="relative flex items-center justify-center w-10 h-10 bg-zinc-900 ring-1 ring-white/10 rounded-lg shadow-xl">
              <div className="w-4 h-4 rounded-sm bg-gradient-to-br from-white to-gray-500 transform rotate-45 group-hover:rotate-90 transition-transform duration-500"></div>
            </div>
          </div>
          <div className="hidden md:flex flex-col shrink-0">
            <span className="text-sm font-bold text-gray-200 tracking-wide">ANIME BIAS</span>
            <span className="text-[10px] font-medium text-gray-500 tracking-[0.2em] uppercase">Coordinate Grid</span>
          </div>
          {/* Vertical Separator */}
          <div className="hidden md:block h-8 w-[1px] bg-white/5 ml-2 shrink-0"></div>
        </div>

        {/* Center: Prominent Title Area */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center justify-center w-full max-w-5xl">
          <style>
            {`
              @keyframes textShine {
                0% { background-position: 0% 50%; }
                100% { background-position: 200% 50%; }
              }
            `}
          </style>
          <div className="relative py-2 px-10 flex flex-col items-center">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full opacity-0 md:opacity-100 transition-opacity"></div>

            <h1
              className="relative text-2xl md:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text drop-shadow-[0_0_25px_rgba(59,130,246,0.6)] text-center whitespace-nowrap z-10 px-4"
              style={{
                backgroundImage: 'linear-gradient(to right, #FFFFFF 20%, #60A5FA 40%, #A5B4FC 60%, #FFFFFF 80%)',
                backgroundSize: '200% auto',
                animation: 'textShine 3s linear infinite'
              }}
            >
              {themeTitle || 'UNTITLED PROJECT'}
            </h1>

            {/* Decorative Energy Lines */}
            <div className="flex items-center gap-2 mt-2 opacity-80 justify-center w-full">
              <div className="h-[2px] w-[100px] md:w-[150px] min-w-[80px] shrink-0 bg-gradient-to-r from-transparent to-blue-400"></div>
              <div className="h-1.5 w-1.5 shrink-0 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(59,130,246,1)] animate-pulse"></div>
              <div className="h-[2px] w-[100px] md:w-[150px] min-w-[80px] shrink-0 bg-gradient-to-l from-transparent to-blue-400"></div>
            </div>
          </div>
        </div>

        {/* Right: Modern Controls */}
        <div className="flex items-center gap-3 relative z-10">
          {/* Axis Toggle - Minimal Glass */}
          <button
            onClick={() => setShowAxisLabels(!showAxisLabels)}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white transition-all hover:scale-105 active:scale-95 group"
            title={showAxisLabels ? "Hide Labels" : "Show Labels"}
          >
            {showAxisLabels ?
              <Eye size={18} className="group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all" /> :
              <EyeOff size={18} className="opacity-50" />
            }
          </button>

          {/* Export Button - High End Primary */}
          <button
            onClick={handleExport}
            className="group relative flex items-center justify-center gap-2 md:gap-3 w-10 h-10 md:w-auto md:h-auto md:pl-4 md:pr-5 md:py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] transition-all active:scale-95 overflow-hidden"
          >
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-900/10 group-hover:bg-zinc-900/20 transition-colors">
              <Download size={12} className="text-zinc-900" />
            </div>
            <span className="hidden md:block tracking-wide shrink-0 whitespace-nowrap">Save Image</span>

            {/* Shimmer Effect */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:animate-shimmer pointer-events-none"></div>
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
          <div
            className={`fixed top-1/2 -translate-y-1/2 z-40 pointer-events-none transition-all duration-500 ease-in-out ${isDockOpen ? 'left-[144px] md:left-[288px]' : 'left-4 md:left-6'
              }`}
          >
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
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
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



      {/* Left Dock - Floating Drawer */}
      <div
        id="anime-dock"
        className={`fixed top-1/2 -translate-y-1/2 z-50 transition-all duration-500 ease-in-out
          ${isDockOpen ? 'left-4 md:left-6' : '-left-[7.5rem] md:-left-[15rem]'} 
          h-[90vh] md:h-[80vh] w-32 md:w-64`}
      >
        {/* Toggle Handle - Moved to Bottom Right edge */}
        <button
          onClick={() => setIsDockOpen(!isDockOpen)}
          className="absolute bottom-8 -right-10 w-10 py-6 bg-gray-800/90 hover:bg-gray-700 backdrop-blur-md border border-gray-600/50 rounded-r-lg flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-all shadow-[5px_0_15px_rgba(0,0,0,0.3)] group z-50 pointer-events-auto"
        >
          {isDockOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
        </button>

        {/* Dock Content */}
        <div className="w-full h-full bg-gray-900/90 backdrop-blur-2xl border border-gray-700/50 shadow-2xl rounded-2xl md:rounded-r-2xl overflow-hidden ring-1 ring-white/10">
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
