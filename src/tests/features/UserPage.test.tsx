import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Home from '@/app/page';

// Mock Supabase Client
const { mockSupabase } = vi.hoisted(() => {
    return {
        mockSupabase: {
            from: vi.fn(),
            storage: {
                from: vi.fn(),
            },
        }
    }
});

vi.mock('@/lib/supabase', () => ({
    supabase: mockSupabase,
}));

// Mock child components
vi.mock('@/components/AnimeGrid', () => ({
    default: ({ items, onLayoutChange }: { items: any[], onLayoutChange: (l: any) => void }) => (
        <div data-testid="anime-grid">
            Grid Items: {items.length}
            {/* Expose method to trigger layout change if needed */}
        </div>
    ),
}));

vi.mock('@/components/AnimeDock', () => ({
    default: ({ items }: { items: any[] }) => (
        <div data-testid="anime-dock">Dock Items: {items.length}</div>
    ),
}));

// Mock external libs
vi.mock('html-to-image', () => ({
    toCanvas: vi.fn(),
}));

// Mock lucide-react icons to avoid rendering issues if any
vi.mock('lucide-react', () => ({
    ChevronUp: () => <span>ChevronUp</span>,
    ChevronDown: () => <span>ChevronDown</span>,
    Download: () => <span>Download</span>,
    Plus: () => <span>Plus</span>,
    Minus: () => <span>Minus</span>,
    Eye: () => <span>Eye</span>,
    EyeOff: () => <span>EyeOff</span>,
}));

describe('User Page (Home)', () => {
    const localStorageMock = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock LocalStorage
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock,
        });

        // Default Supabase Mock for Themes
        const mockThemeSelect = vi.fn().mockReturnValue({
            data: { id: 'theme-123', title: 'Test Theme', axis_top: 'Top', axis_bottom: 'Bottom', axis_left: 'Left', axis_right: 'Right' },
            error: null
        });

        // Default Supabase Mock for Items
        const mockItemsSelect = vi.fn().mockResolvedValue({
            data: [
                { id: '1', title: 'Anime 1', image_url: 'img1.jpg', year: '2024' },
                { id: '2', title: 'Anime 2', image_url: 'img2.jpg', year: '2024' }
            ],
            error: null
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'themes') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: mockThemeSelect
                        })
                    })
                };
            }
            if (table === 'anime_items') {
                return {
                    select: () => ({
                        eq: mockItemsSelect
                    })
                };
            }
            return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn(),
            };
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('loads data from Supabase when localStorage is empty and sets isDataLoaded checking race condition', async () => {
        localStorageMock.getItem.mockReturnValue(null); // No saved data

        render(<Home />);

        // Wait for theme title to appear (indicates data load)
        await waitFor(() => expect(screen.getByText('Test Theme')).toBeInTheDocument());

        // Check if items loaded into Dock
        await waitFor(() => expect(screen.getByTestId('anime-dock')).toHaveTextContent('Dock Items: 2'));

        // Expect setItem was NOT called with empty data initially?
        // Actually, logic: load -> set isDataLoaded(true) -> effect runs -> saves current state.
        // Initial state is empty -> load -> state updates -> save.
        // The fix prevents saving BEFORE load is performing.

        // We expect setItem to be called eventually with the LOADED data, but NOT with empty data during init.
        // The component fetches theme -> fetches items -> updates state -> isDataLoaded(true) -> triggers save.

        // Let's verify that what was saved is NOT empty.
        await waitFor(() => {
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });

        const lastCall = localStorageMock.setItem.mock.lastCall;
        if (lastCall) {
            const savedData = JSON.parse(lastCall[1]);
            expect(savedData.dockItems.length).toBe(2); // Should have loaded items
        }
    });

    it('loads data from localStorage if available', async () => {
        const savedData = {
            gridItems: [{ layoutId: 'l1', id: '1', title: 'Saved Anime', imageUrl: 'img.jpg' }],
            layout: [{ i: 'l1', x: 0, y: 0, w: 1, h: 1 }],
            dockItems: []
        };

        // Mock localStorage having data for the theme
        // We need to know the theme ID first. The component fetches theme ID 'theme-123'.
        // So it looks for 'animebias_save_theme-123'.
        // BUT mocks are synchronous in setup, component is async.
        // We set up getItem to return data when requested.

        localStorageMock.getItem.mockImplementation((key) => {
            if (key === 'animebias_save_theme-123') {
                return JSON.stringify(savedData);
            }
            return null;
        });

        render(<Home />);

        await waitFor(() => expect(screen.getByText('Test Theme')).toBeInTheDocument());

        // Should have loaded from localStorage -> Grid has 1 item
        await waitFor(() => expect(screen.getByTestId('anime-grid')).toHaveTextContent('Grid Items: 1'));
    });

    it('does not save to localStorage before data is loaded', async () => {
        // Simulate slow network for items
        let resolveItems: any;
        const itemsPromise = new Promise(resolve => { resolveItems = resolve; });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'themes') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: vi.fn().mockResolvedValue({
                                data: { id: 'slow-theme', title: 'Slow Theme' },
                                error: null
                            })
                        })
                    })
                };
            }
            if (table === 'anime_items') {
                return {
                    select: () => ({
                        eq: () => itemsPromise // HANGS HERE
                    })
                };
            }
            return { select: vi.fn() };
        });

        render(<Home />);

        // Theme loads, logic proceeds to items fetch... waits. isDataLoaded is false.
        await waitFor(() => expect(screen.getByText('Slow Theme')).toBeInTheDocument());

        // Check localStorage calls. Should be NONE because isDataLoaded is false.
        expect(localStorageMock.setItem).not.toHaveBeenCalled();

        // Now resolve items
        resolveItems({ data: [{ id: '1' }] });

        // Wait for update
        await waitFor(() => expect(screen.getByTestId('anime-dock')).toHaveTextContent('Dock Items: 1'));

        // NOW it should verify save happened
        await waitFor(() => expect(localStorageMock.setItem).toHaveBeenCalled());
    });
});
