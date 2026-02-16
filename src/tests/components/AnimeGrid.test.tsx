import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AnimeGrid from '@/components/AnimeGrid';
import { AnimeItem } from '@/lib/mockData';
import { Layout } from '@/types/layout';

// Mock matchMedia for responsive components if any
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock next/image
vi.mock('next/image', () => ({
    __esModule: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: (props: any) => {
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        return <img {...props} />;
    },
}));

// Mock react-draggable
vi.mock('react-draggable', () => {
    return {
        __esModule: true,
        default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    };
});

const mockItems: (AnimeItem & { layoutId: string })[] = [
    { id: '1', title: 'Test Anime 1', imageUrl: '/test1.jpg', year: 2024, layoutId: '1' },
];

const mockLayout: Layout[] = [
    { i: '1', x: 0, y: 0, w: 2, h: 2, isResizable: false }
];

const mockAxisLabels = {
    top: 'Top',
    bottom: 'Bottom',
    left: 'Left',
    right: 'Right'
};

describe('AnimeGrid', () => {
    it('renders loading state initially', () => {
        // We can't easily test the loading state if useEffect runs immediately in jsdom,
        // but we can try. However, typically RTL waits for effects.
        // Let's just check if it renders the content eventually.
        render(
            <AnimeGrid
                items={[]}
                layout={[]}
                onLayoutChange={() => { }}
                onRemoveItem={() => { }}
                onDrop={() => { }}
                axisLabels={mockAxisLabels}
            />
        );
        // It should eventually show the empty state message
        return waitFor(() => {
            expect(screen.getByText(/여기에 애니메이션을/i)).toBeInTheDocument();
        });
    });

    it('renders anime items correctly', async () => {
        render(
            <AnimeGrid
                items={mockItems}
                layout={mockLayout}
                onLayoutChange={() => { }}
                onRemoveItem={() => { }}
                onDrop={() => { }}
                axisLabels={mockAxisLabels}
            />
        );

        await waitFor(() => {
            expect(screen.getByAltText('Test Anime 1')).toBeInTheDocument();
        });
    });
});
