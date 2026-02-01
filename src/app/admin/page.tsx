'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import AnimeGrid from '@/components/AnimeGrid';
import AnimeDock from '@/components/AnimeDock';
import { AnimeItem, MOCK_AXIS, MOCK_THEME, MOCK_ANIME_LIST } from '@/lib/mockData';
import { Layout } from 'react-grid-layout';

export default function AdminPage() {
    // Auth State (Secure)
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Check session on load
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Editor State
    const [themeTitle, setThemeTitle] = useState(MOCK_THEME);
    const [axisLabels, setAxisLabels] = useState(MOCK_AXIS);
    const [dockItems, setDockItems] = useState<AnimeItem[]>(MOCK_ANIME_LIST);
    const [newAnime, setNewAnime] = useState<{ id?: string, title: string, imageUrl: string, year: number }>({ id: '', title: '', imageUrl: '', year: 2024 });

    // History State
    const [historyThemes, setHistoryThemes] = useState<any[]>([]);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string>('');

    // Preview State
    const [refreshPreview, setRefreshPreview] = useState(0);

    // --- Helper Functions ---

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

    // Fetch history when authenticated
    useEffect(() => {
        if (isAuthenticated) {
            fetchHistory();
        }
    }, [isAuthenticated]);

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
                            Theme Editor
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
                        <label className="text-xs text-gray-400 uppercase font-semibold block mb-2">Load From History</label>
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
                        <label className="text-sm text-gray-400">Theme Title</label>
                        <input
                            value={themeTitle}
                            onChange={(e) => setThemeTitle(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded p-2 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Axis Config */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">Axis Configuration</h3>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="text-xs text-blue-400 mb-1 block">Top Label (Y+)</label>
                            <input value={axisLabels.top} onChange={e => setAxisLabels({ ...axisLabels, top: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-blue-400 mb-1 block">Bottom Label (Y-)</label>
                            <input value={axisLabels.bottom} onChange={e => setAxisLabels({ ...axisLabels, bottom: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-green-400 mb-1 block">Left Label (X-)</label>
                            <input value={axisLabels.left} onChange={e => setAxisLabels({ ...axisLabels, left: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-green-400 mb-1 block">Right Label (X+)</label>
                            <input value={axisLabels.right} onChange={e => setAxisLabels({ ...axisLabels, right: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm" />
                        </div>
                    </div>
                </div>

                {/* Anime Manager */}
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">Anime List ({dockItems.length})</h3>

                    {/* Add New / Edit */}
                    <div className="p-4 bg-gray-900 rounded border border-gray-800 mb-4 space-y-3">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-gray-400">
                                {newAnime.id ? 'Edit Anime' : 'Add New Anime'}
                            </span>
                            {newAnime.id && (
                                <button
                                    onClick={() => setNewAnime({ id: '', title: '', imageUrl: '', year: 2024 })}
                                    className="text-xs text-gray-500 hover:text-white"
                                >
                                    Cancel Edit
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
                            Update Existing Theme
                        </button>
                    )}
                    <button
                        onClick={handlePublish}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-3 rounded-lg font-bold text-white shadow-lg transition-all active:scale-95"
                    >
                        Publish as New Theme
                    </button>
                </div>
            </div>

            {/* Right: Preview Area */}
            <div className="flex-1 flex flex-col bg-black relative">
                <div className="absolute top-4 right-4 z-50 bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded text-xs font-mono border border-yellow-500/50">
                    LIVE PREVIEW MODE
                </div>

                {/* Re-use the exact layout from home page for fidelity */}
                <header className="h-16 px-6 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 flex justify-between items-center z-20 shrink-0 pointer-events-none opacity-80">
                    <div className="flex items-center gap-4">
                        <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                            {themeTitle}
                        </h1>
                    </div>
                </header>

                <div
                    className="flex-1 relative overflow-hidden flex flex-col"
                    style={{
                        backgroundImage: 'radial-gradient(#374151 1px, transparent 1px)',
                        backgroundSize: '24px 24px'
                    }}
                >
                    {/* Render Grid in non-interactive or semi-interactive mode just to show axes */}
                    <div className="flex-1 overflow-hidden p-8 flex items-center justify-center">
                        <div className="w-full max-w-[1200px] h-[600px] relative border border-dashed border-gray-700 rounded-xl bg-gray-900/30">
                            {/* Axis Visualization using formatting from Grid */}
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-400 bg-gray-900 px-2 py-1 rounded border border-gray-700">{axisLabels.top} ▲</div>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-400 bg-gray-900 px-2 py-1 rounded border border-gray-700">▼ {axisLabels.bottom}</div>
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 bg-gray-900 px-2 py-1 rounded border border-gray-700">◀ {axisLabels.left}</div>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 bg-gray-900 px-2 py-1 rounded border border-gray-700">{axisLabels.right} ▶</div>
                            <div className="absolute inset-0 flex items-center justify-center text-gray-600 pointer-events-none">
                                Grid Area (Items drop here)
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-48 z-30 bg-gray-900/95 border-t border-gray-800 shrink-0">
                    <AnimeDock items={dockItems} />
                </div>
            </div>
        </div>
    );
}
