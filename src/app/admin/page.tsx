'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import AnimeGrid from '@/components/AnimeGrid';
import AnimeDock from '@/components/AnimeDock';
import { AnimeItem, MOCK_AXIS, MOCK_THEME, MOCK_ANIME_LIST } from '@/lib/mockData';
import { ChevronUp, ChevronDown, Download, Eye, EyeOff } from 'lucide-react';


export default function AdminPage() {
    // Auth State (Secure)
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Check session on load
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Editor State
    const [themeTitle, setThemeTitle] = useState('');
    const [axisLabels, setAxisLabels] = useState({ top: '', bottom: '', left: '', right: '' });
    const [dockItems, setDockItems] = useState<AnimeItem[]>([]);
    const [newAnime, setNewAnime] = useState<{ id?: string, title: string, imageUrl: string, year: number }>({ id: '', title: '', imageUrl: '', year: 2024 });

    // History State
    const [historyThemes, setHistoryThemes] = useState<any[]>([]);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string>('');

    // Preview State
    const [refreshPreview, setRefreshPreview] = useState(0);
    const [previewDockOpen, setPreviewDockOpen] = useState(true);

    // Preview Grid State
    const [gridItems, setGridItems] = useState<(AnimeItem & { layoutId: string })[]>([]);
    const [layout, setLayout] = useState<any[]>([]); // Using any for Layout to avoid import issues for now, or I'll add import in next step

    // --- Helper Functions ---

    // Preview Grid Handlers
    const handlePreviewDrop = (layout: any[], layoutItem: any, _event: any) => {
        // e is a native ResizeObserver entry?? No, in RGL onDrop, the third arg is the Event.
        const event = _event as DragEvent;
        const data = event.dataTransfer?.getData("application/json");
        // Fallback for different drag data types if needed
        const itemDataString = data || event.dataTransfer?.getData("text/plain");

        if (!itemDataString) return;

        try {
            const itemData = JSON.parse(itemDataString);

            // Avoid duplicates if needed, but logic says move from dock to grid
            setDockItems(prev => prev.filter(i => i.id !== itemData.id));

            const newLayoutId = `${itemData.id}-${Date.now()}`;
            const newGridItem = { ...itemData, layoutId: newLayoutId };

            setGridItems(prev => [...prev, newGridItem]);

            // Update Layout
            const newLayoutItem = {
                ...layoutItem,
                i: newLayoutId,
                isResizable: false
            };

            setLayout(prev => [...prev, newLayoutItem]);

        } catch (e) {
            console.error("Failed to parse drop data", e);
        }
    };

    const handlePreviewLayoutChange = (newLayout: any[]) => {
        setLayout(newLayout);
    };

    const handleRemoveItemFromGrid = (layoutId: string) => {
        const itemToRemove = gridItems.find(i => i.layoutId === layoutId);
        if (!itemToRemove) return;

        const { layoutId: _, ...cleanedItem } = itemToRemove;

        setGridItems(prev => prev.filter(i => i.layoutId !== layoutId));
        setDockItems(prev => [...prev, cleanedItem]); // Return to dock
        setLayout(prev => prev.filter(l => l.i !== layoutId));
    };

    const fetchHistory = async () => {
        if (!isAuthenticated) return;
        const { data } = await supabase.from('themes').select('id, title, created_at').order('created_at', { ascending: false });
        if (data) setHistoryThemes(data);
    };

    const loadThemeHistory = async (themeId: string) => {
        if (!themeId) return;

        // 1. Fetch Theme
        const { data: theme } = await supabase.from('themes').select('*').eq('id', themeId).single();
        if (theme) {
            setThemeTitle(theme.title);
            setAxisLabels({
                top: theme.axis_top,
                bottom: theme.axis_bottom,
                left: theme.axis_left,
                right: theme.axis_right
            });
        }

        // 2. Fetch Anime Items
        const { data: items } = await supabase.from('anime_items').select('*').eq('theme_id', themeId);
        if (items) {
            setDockItems(items.map((i: any) => ({
                id: i.id,
                title: i.title,
                imageUrl: i.image_url,
                year: i.year
            })));
        }

        // Force refresh preview
        setRefreshPreview(prev => prev + 1);
    };

    const addAnimeItem = () => {
        if (!newAnime.title || !newAnime.imageUrl) return;

        if (newAnime.id) {
            // Edit Mode
            setDockItems(dockItems.map(item =>
                item.id === newAnime.id
                    ? { ...item, title: newAnime.title, imageUrl: newAnime.imageUrl, year: newAnime.year }
                    : item
            ));
        } else {
            // Add Mode
            const newItem: AnimeItem = {
                id: crypto.randomUUID(),
                title: newAnime.title,
                imageUrl: newAnime.imageUrl,
                year: newAnime.year
            };
            setDockItems([...dockItems, newItem]);
        }
        setNewAnime({ id: '', title: '', imageUrl: '', year: 2024 });
    };

    const removeAnimeItem = (id: string) => {
        setDockItems(dockItems.filter(i => i.id !== id));
    };

    // --- Effects ---

    useEffect(() => {
        // Check active session on mount
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    setIsAuthenticated(true);
                }
            } catch (error) {
                console.error("Session check error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                setIsAuthenticated(true);
            } else {
                setIsAuthenticated(false);
            }
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch history and Active Theme when authenticated
    useEffect(() => {
        if (isAuthenticated) {
            fetchHistory();
            fetchActiveTheme();
        }
    }, [isAuthenticated]);

    const fetchActiveTheme = async () => {
        // Find the currently active theme
        const { data: activeTheme } = await supabase.from('themes').select('id').eq('is_active', true).single();
        if (activeTheme) {
            setSelectedHistoryId(activeTheme.id);
            await loadThemeHistory(activeTheme.id);
        }
    };

    // --- Auth Helpers ---

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Login successful
            if (data.user) {
                setIsAuthenticated(true);
            }
        } catch (error: any) {
            alert('Login failed: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        setEmail('');
        setPassword('');
    };

    const handlePublish = async () => {
        if (!confirm("Are you sure you want to publish this theme? This will update the live site.")) return;

        try {
            // 1. Deactivate old themes
            await supabase.from('themes').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000'); // safe update

            // 2. Insert new theme
            const { data: themeData, error: themeError } = await supabase.from('themes').insert({
                title: themeTitle,
                axis_top: axisLabels.top,
                axis_bottom: axisLabels.bottom,
                axis_left: axisLabels.left,
                axis_right: axisLabels.right,
                is_active: true,
                created_at: new Date().toISOString()
            }).select().single();

            if (themeError) throw themeError;

            // 3. Insert anime items
            if (dockItems.length > 0) {
                const animeToInsert = dockItems.map(item => ({
                    theme_id: themeData.id,
                    title: item.title,
                    image_url: item.imageUrl,
                    year: item.year
                }));

                const { error: itemsError } = await supabase.from('anime_items').insert(animeToInsert);
                if (itemsError) throw itemsError;
            }

            alert("Successfully Published!");
            fetchHistory();
        } catch (e: any) {
            alert("Error publishing: " + e.message);
        }
    };

    // Update Existing Theme Function
    const handleUpdateTheme = async () => {
        if (!selectedHistoryId) return;
        if (!confirm("Are you sure you want to overwrite this existing theme?")) return;

        try {
            // 1. Update Theme Info
            const { error: themeError } = await supabase.from('themes').update({
                title: themeTitle,
                axis_top: axisLabels.top,
                axis_bottom: axisLabels.bottom,
                axis_left: axisLabels.left,
                axis_right: axisLabels.right,
            }).eq('id', selectedHistoryId);

            if (themeError) throw themeError;

            // 2. Sync Anime Items (Full Replacement Strategy)
            // 2a. Delete old items
            await supabase.from('anime_items').delete().eq('theme_id', selectedHistoryId);

            // 2b. Insert new items
            if (dockItems.length > 0) {
                const animeToInsert = dockItems.map(item => ({
                    theme_id: selectedHistoryId,
                    title: item.title,
                    image_url: item.imageUrl,
                    year: item.year
                }));
                const { error: itemsError } = await supabase.from('anime_items').insert(animeToInsert);
                if (itemsError) throw itemsError;
            }

            alert("Theme updated successfully!");
            fetchHistory();
        } catch (e: any) {
            alert("Error updating theme: " + e.message);
        }
    };

    // Delete History
    const handleDeleteHistory = async () => {
        if (!selectedHistoryId) return;
        if (!confirm("Are you sure you want to delete this theme history? This cannot be undone.")) return;

        try {
            // 1. Delete anime items (Cascading delete handles this usually, but safe to be explicit if no cascade)
            const { error: itemsError } = await supabase.from('anime_items').delete().eq('theme_id', selectedHistoryId);
            if (itemsError) throw itemsError;

            // 2. Delete theme
            const { error: themeError } = await supabase.from('themes').delete().eq('id', selectedHistoryId);
            if (themeError) throw themeError;

            alert("History deleted successfully.");
            setSelectedHistoryId('');
            fetchHistory(); // Refresh list

            // Reset editor if deleted theme was loaded
            // Optional: You might want to clear the editor or leave it as is.
        } catch (e: any) {
            alert("Error deleting history: " + e.message);
        }
    };

    // Loading State
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-4 w-4 bg-purple-500 rounded-full mb-2"></div>
                    <p className="text-sm text-gray-400">Verifying Access...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
                <div className="p-8 bg-gray-900 rounded-lg border border-gray-800 w-full max-w-md shadow-2xl">
                    <h2 className="text-2xl mb-2 font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        Admin Access
                    </h2>
                    <p className="text-gray-400 text-sm mb-6">Restricted area. Authorized personnel only.</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-gray-950 border border-gray-800 focus:border-purple-500 p-3 rounded text-sm outline-none transition-colors"
                                placeholder="admin@example.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-gray-950 border border-gray-800 focus:border-purple-500 p-3 rounded text-sm outline-none transition-colors"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-3 rounded font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Verifying...' : 'Login'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Image Upload Handler
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        try {
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload to Supabase 'anime-assets' bucket
            const { error: uploadError } = await supabase.storage
                .from('anime-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data } = supabase.storage
                .from('anime-assets')
                .getPublicUrl(filePath);

            setNewAnime(prev => ({ ...prev, imageUrl: data.publicUrl }));
        } catch (error: any) {
            alert('Error uploading image: ' + error.message);
        }
    };

    return (
        <div className="h-screen w-full flex bg-gray-950 text-white overflow-hidden">
            {/* Left Sidebar: Editor */}
            <div className="w-[400px] h-full overflow-y-auto border-r border-gray-800 bg-gray-900/50 p-6 flex flex-col gap-8 scrollbar-thin">
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                            주제 관리
                        </h2>
                        <button
                            onClick={handleLogout}
                            className="text-xs text-gray-500 hover:text-white underline"
                        >
                            Logout
                        </button>
                    </div>

                    {/* History */}
                    <div className="mb-6 p-4 bg-gray-900 rounded border border-gray-800">
                        <label className="text-xs text-gray-400 uppercase font-semibold block mb-2">주제 목록</label>
                        <div className="flex gap-2">
                            <select
                                className="flex-1 bg-gray-950 border border-gray-700 rounded p-2 text-sm"
                                onChange={(e) => {
                                    setSelectedHistoryId(e.target.value);
                                    loadThemeHistory(e.target.value);
                                }}
                                value={selectedHistoryId}
                            >
                                <option value="">Select a previous theme...</option>
                                {historyThemes.map(h => (
                                    <option key={h.id} value={h.id}>{h.title} ({new Date(h.created_at).toLocaleDateString()})</option>
                                ))}
                            </select>
                            {selectedHistoryId && (
                                <button
                                    onClick={handleDeleteHistory}
                                    className="px-3 bg-red-600 hover:bg-red-700 rounded text-white text-xs font-bold transition-colors"
                                    title="Delete this history"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Theme Title */}
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">주제</label>
                        <input
                            value={themeTitle}
                            onChange={(e) => setThemeTitle(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded p-2 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Axis Config */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">축 설정</h3>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="text-xs text-blue-400 mb-1 block">상단 축값 (Y+)</label>
                            <input value={axisLabels.top} onChange={e => setAxisLabels({ ...axisLabels, top: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-blue-400 mb-1 block">하단 축값 (Y-)</label>
                            <input value={axisLabels.bottom} onChange={e => setAxisLabels({ ...axisLabels, bottom: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-green-400 mb-1 block">좌측 축값 (X-)</label>
                            <input value={axisLabels.left} onChange={e => setAxisLabels({ ...axisLabels, left: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-green-400 mb-1 block">우측 축값 (X+)</label>
                            <input value={axisLabels.right} onChange={e => setAxisLabels({ ...axisLabels, right: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm" />
                        </div>
                    </div>
                </div>

                {/* Anime Manager */}
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">애니 목록 ({dockItems.length})</h3>

                    {/* Add New / Edit */}
                    <div className="p-4 bg-gray-900 rounded border border-gray-800 mb-4 space-y-3">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-gray-400">
                                {newAnime.id ? '애니 수정' : '애니 추가'}
                            </span>
                            {newAnime.id && (

                                <button
                                    onClick={() => setNewAnime({ id: '', title: '', imageUrl: '', year: 2024 })}
                                    className="text-xs text-gray-500 hover:text-white"
                                >
                                    수정 취소
                                </button>
                            )}
                        </div>
                        <input
                            placeholder="Anime Title"
                            className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm"
                            value={newAnime.title}
                            onChange={e => setNewAnime({ ...newAnime, title: e.target.value })}
                        />
                        <div className="space-y-1">
                            <label className="text-xs text-gray-500">Image URL or Upload</label>
                            <div className="flex gap-2">
                                <input
                                    placeholder="https://..."
                                    className="flex-1 bg-gray-950 border border-gray-700 rounded p-2 text-sm"
                                    value={newAnime.imageUrl}
                                    onChange={e => setNewAnime({ ...newAnime, imageUrl: e.target.value })}
                                />
                                <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-2 rounded text-xs flex items-center justify-center">
                                    Upload
                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                </label>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={addAnimeItem}
                                className={`text-xs px-3 py-2 rounded font-medium ${newAnime.id ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                            >
                                {newAnime.id ? 'Update Anime' : 'Add Anime'}
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {dockItems.map(item => (
                            <div
                                key={item.id}
                                onClick={() => setNewAnime({ ...item })}
                                className={`group flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${newAnime.id === item.id ? 'bg-gray-800 border-purple-500' : 'bg-gray-900 border-gray-800 hover:border-gray-600'}`}
                            >
                                <img src={item.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                                <span className="text-xs truncate flex-1">{item.title}</span>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        removeAnimeItem(item.id);
                                    }}
                                    className="text-red-500 hover:text-red-400 p-2 hover:bg-gray-800 rounded transition-colors"
                                    title="Remove Anime"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Publish Actions */}
                <div className="pt-4 border-t border-gray-800 sticky bottom-0 bg-gray-900/50 backdrop-blur pb-6 space-y-3">
                    {selectedHistoryId && (
                        <button
                            onClick={handleUpdateTheme}
                            className="w-full bg-gray-800 hover:bg-gray-700 py-3 rounded-lg font-bold text-white shadow-lg transition-all border border-gray-600"
                        >
                            주제 업데이트
                        </button>
                    )}
                    <button
                        onClick={handlePublish}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-3 rounded-lg font-bold text-white shadow-lg transition-all active:scale-95"
                    >
                        주제 추가
                    </button>
                </div>
            </div>

            {/* Right: Preview Area */}
            {/* Right: Preview Area */}
            <div className="flex-1 flex flex-col bg-stone-950 relative overflow-hidden selection:bg-orange-500/30">
                <div className="absolute top-20 right-4 z-50 bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded text-xs font-mono border border-yellow-500/50 pointer-events-none">
                    사용자 화면 미리보기
                </div>

                {/* Simulated Header */}
                <header className="absolute top-0 left-0 right-0 h-16 bg-stone-900/80 backdrop-blur-md border-b border-stone-800 z-20 flex justify-between items-center px-6 select-none shadow-lg">
                    {/* Left: Placeholder */}
                    <div className="w-[88px] h-14 bg-stone-800 rounded-md border border-stone-700 shrink-0 opacity-50 flex items-center justify-center pointer-events-none">
                        <span className="text-[10px] text-stone-500 font-bold">550x350</span>
                    </div>

                    {/* Center: Title */}
                    <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-bold text-stone-100 tracking-wide max-w-[200px] truncate pointer-events-none">
                        {themeTitle || 'Theme Title'}
                    </h1>

                    {/* Right: Mock Buttons */}
                    <div className="flex items-center gap-3">
                        <button
                            className="flex items-center gap-2 px-3 py-2 bg-stone-800 text-stone-200 rounded-lg text-sm font-bold shadow-md border border-stone-700 opacity-80 cursor-not-allowed"
                            title="Mock Button"
                        >
                            <Eye size={16} />
                        </button>

                        <button
                            className="flex items-center gap-2 px-3 py-2 bg-stone-100 text-stone-900 rounded-lg text-sm font-bold shadow-md opacity-80 cursor-not-allowed"
                        >
                            <Download size={16} />
                            <span className="hidden md:inline">Save Image</span>
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-stone-950">
                    <AnimeGrid
                        items={gridItems}
                        layout={layout}
                        onLayoutChange={handlePreviewLayoutChange}
                        onRemoveItem={handleRemoveItemFromGrid}
                        onDrop={handlePreviewDrop}
                        axisLabels={axisLabels}
                        scale={0.85}
                        showAxisLabels={true}
                        dockId="anime-dock-preview"
                    />
                </div>

                {/* Simulated Sticky Axis Labels */}
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <span className="font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm whitespace-nowrap text-xs">
                        {axisLabels.top} ▲
                    </span>
                </div>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <span className="block font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm text-center whitespace-nowrap text-xs">
                        ◀ {axisLabels.left}
                    </span>
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <span className="block font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm text-center whitespace-nowrap text-xs">
                        {axisLabels.right} ▶
                    </span>
                </div>

                {/* Bottom Label - Dynamic Position */}
                <div
                    className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-all duration-500 ease-in-out"
                    style={{ bottom: previewDockOpen ? '14rem' : '2rem' }}
                >
                    <span className="font-bold text-gray-400 bg-gray-900/90 px-3 py-1 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm whitespace-nowrap text-xs">
                        ▼ {axisLabels.bottom}
                    </span>
                </div>

                {/* Floating Dock Preview - Interactive */}
                <div
                    id="anime-dock-preview"
                    className={`absolute left-1/2 -translate-x-1/2 w-[90%] h-48 z-30 transition-all duration-500 ease-in-out ${previewDockOpen ? 'bottom-6' : '-bottom-[11rem]'}`}
                >
                    {/* Toggle Handle */}
                    <button
                        onClick={() => setPreviewDockOpen(!previewDockOpen)}
                        className="absolute -top-10 right-8 h-10 px-6 bg-gray-800/90 hover:bg-gray-700 backdrop-blur-md border border-gray-600/50 rounded-lg flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-all shadow-[0_-5px_15px_rgba(0,0,0,0.3)] z-50 cursor-pointer"
                    >
                        {previewDockOpen ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                    </button>

                    <div className="w-full h-full bg-gray-900/90 backdrop-blur-2xl border border-gray-700/50 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/10 pointer-events-auto">
                        <AnimeDock items={dockItems} />
                    </div>
                </div>
            </div>
        </div>
    );
}
