import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Home from '@/app/page';
import { AnimeItem } from '@/lib/mockData';

// Mock Supabase
const { mockSupabase } = vi.hoisted(() => {
    return {
        mockSupabase: {
            from: vi.fn(),
            storage: { from: vi.fn() },
        }
    }
});

vi.mock('@/lib/supabase', () => ({
    supabase: mockSupabase,
}));

// Mock react-draggable
vi.mock('react-draggable', () => {
    return {
        __esModule: true,
        default: ({ children, onStart }: any) => {
            return (
                <div data-testid="draggable-item" onMouseDown={onStart}>
                    {children}
                </div>
            );
        }
    };
});

// Mock react-grid-layout
vi.mock('react-grid-layout', () => {
    return {
        __esModule: true,
        Responsive: ({ children, onDrop }: any) => {
            return (
                <div
                    data-testid="responsive-grid-layout"
                    onDrop={(e) => {
                        if (onDrop) onDrop(children, {}, e);
                    }}
                >
                    {children}
                </div>
            );
        },
        WidthProvider: (Comp: any) => Comp,
    };
});

// Mock next/image
vi.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => <img {...props} />,
}));

// Mock html-to-image
vi.mock('html-to-image', () => ({
    toCanvas: vi.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

describe('Home Integration Flow', () => {
    let localStorageMock: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Proper LocalStorage Mock
        localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            length: 0,
            key: vi.fn(),
        };
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock,
            writable: true
        });

        const mockTheme = {
            id: 'theme-integrated',
            title: 'Integrated Theme',
            axis_top: 'T', axis_bottom: 'B', axis_left: 'L', axis_right: 'R',
            is_active: true
        };

        const mockItems: AnimeItem[] = [
            { id: 'item-1', title: 'Anime One', imageUrl: '/img1.jpg', year: 2024 },
            { id: 'item-2', title: 'Anime Two', imageUrl: '/img2.jpg', year: 2024 }
        ];

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'themes') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: vi.fn().mockResolvedValue({ data: mockTheme, error: null })
                        })
                    })
                };
            }
            if (table === 'anime_items') {
                return {
                    select: () => ({
                        eq: vi.fn().mockResolvedValue({ data: mockItems, error: null })
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

    it('loads data, drags item from dock to grid, and updates state', async () => {
        render(<Home />);

        // 1. Verify Loading & Initial State
        await waitFor(() => {
            expect(screen.getByText('Integrated Theme')).toBeInTheDocument();
        });

        expect(screen.getByText(/여기에 애니메이션을/i)).toBeInTheDocument();
        expect(screen.getByAltText('Anime One')).toBeInTheDocument();

        // 2. Simulate Drag and Drop
        const mockDataTransfer = {
            getData: vi.fn().mockImplementation((format) => {
                if (format === 'application/json') {
                    return JSON.stringify({
                        id: 'item-1',
                        title: 'Anime One',
                        imageUrl: '/img1.jpg',
                        year: 2024
                    });
                }
                return '';
            }),
            setData: vi.fn(),
            types: ['application/json']
        };

        const emptyText = screen.getByText(/여기에 애니메이션을/i);
        const gridDropZone = emptyText.closest('div[id^="anime-grid"]');

        if (!gridDropZone) throw new Error("Grid Drop Zone not found");

        fireEvent.drop(gridDropZone, {
            dataTransfer: mockDataTransfer,
            clientX: 500,
            clientY: 500
        });

        // 3. Verify Result
        await waitFor(() => {
            expect(screen.queryByText(/여기에 애니메이션을/i)).not.toBeInTheDocument();
        });

        expect(screen.getByAltText('Anime One')).toBeInTheDocument();

        // Verify LocalStorage updated (using the spy we created)
        await waitFor(() => {
            // Home loads -> fetches -> sets loaded -> might save initial state?
            // Then drop -> updates state -> triggers save.
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });
    });
});
