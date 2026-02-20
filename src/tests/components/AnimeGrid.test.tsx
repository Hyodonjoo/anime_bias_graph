import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnimeGrid from '@/components/AnimeGrid';
import { AnimeItem } from '@/lib/mockData';
import { Layout } from '@/types/layout';

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

// Mock next/image
vi.mock('next/image', () => ({
    __esModule: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: (props: any) => {
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        return <img {...props} />;
    },
}));

// Mock react-draggable to allow triggering handlers
vi.mock('react-draggable', () => {
    return {
        __esModule: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        default: ({ children, onDrag, onStop }: any) => (
            <div data-testid="draggable-wrapper">
                <button
                    data-testid="trigger-drag"
                    onClick={(e) => onDrag(e, { x: 50, y: 50 })}
                />
                <button
                    data-testid="trigger-stop"
                    onClick={() => {
                        // Create a fake mouse event with specific coordinates
                        // In JSDOM, we can use the MouseEvent constructor
                        const fakeEvent = new MouseEvent('mouseup', {
                            clientX: 500,
                            clientY: 800,
                            bubbles: true
                        });

                        // Pass the event FIRST, then data
                        onStop(fakeEvent, { x: 50, y: 50 });
                    }}
                />
                {children}
            </div>
        ),
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
    // Mock getBoundingClientRect
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

    beforeEach(() => {
        Element.prototype.getBoundingClientRect = vi.fn(() => ({
            width: 1000,
            height: 1000,
            top: 0,
            left: 0,
            bottom: 1000,
            right: 1000,
            x: 0,
            y: 0,
            toJSON: () => { }
        }));
    });

    afterEach(() => {
        Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
        vi.clearAllMocks();
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

    it('triggers onLayoutChange when item dragging updates position', async () => {
        const onLayoutChangeSpy = vi.fn();

        render(
            <AnimeGrid
                items={mockItems}
                layout={mockLayout}
                onLayoutChange={onLayoutChangeSpy}
                onRemoveItem={() => { }}
                onDrop={() => { }}
                axisLabels={mockAxisLabels}
            />
        );

        // Find the hidden trigger button from our mock
        const dragBtn = screen.getByTestId('trigger-drag');
        fireEvent.click(dragBtn);

        expect(onLayoutChangeSpy).toHaveBeenCalled();
        // Check if layout was updated with new coordinates (x: 50, y: 50 from mock)
        const updatedLayout = onLayoutChangeSpy.mock.calls[0][0];
        expect(updatedLayout[0].x).toBe(50);
        expect(updatedLayout[0].y).toBe(50);
    });

    it('triggers onRemoveItem when item is dropped onto the dock area', async () => {
        const onRemoveItemSpy = vi.fn();
        const dockId = 'test-dock';

        // Setup Dock Element in DOM
        const dockElement = document.createElement('div');
        dockElement.id = dockId;
        document.body.appendChild(dockElement);

        // Mock Dock Rect to verify collision logic
        // We simulate a drop at (500, 800). Let's place dock there.
        dockElement.getBoundingClientRect = vi.fn(() => ({
            width: 200,
            height: 100,
            top: 750,
            bottom: 850,
            left: 400,
            right: 600,
            x: 400,
            y: 750,
            toJSON: () => { }
        }));

        // Mock container rect to avoid calculation issues in handleDropInternal if called,
        // though handleItemDragStop is what we are targeting.
        // But handleItemDragStop calls document.getElementById.

        render(
            <AnimeGrid
                items={mockItems}
                layout={mockLayout}
                onLayoutChange={() => { }}
                onRemoveItem={onRemoveItemSpy}
                onDrop={() => { }}
                axisLabels={mockAxisLabels}
                dockId={dockId} // Pass dockId
            />
        );

        const stopBtn = screen.getByTestId('trigger-stop');
        fireEvent.click(stopBtn);

        expect(onRemoveItemSpy).toHaveBeenCalledWith('1');

        // Cleanup
        document.body.removeChild(dockElement);
    });
});
