import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnimeDock from '@/components/AnimeDock';
import { AnimeItem } from '@/lib/mockData';

// Mock next/image
// Mock next/image
vi.mock('next/image', () => ({
    __esModule: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: (props: any) => {
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        return <img {...props} />;
    },
}));

const mockItems: AnimeItem[] = [
    { id: '1', title: 'Test Anime 1', imageUrl: '/test1.jpg', year: 2024 },
    { id: '2', title: 'Test Anime 2', imageUrl: '/test2.jpg', year: 2024 },
];

describe('AnimeDock', () => {
    it('renders correctly with items', () => {
        render(<AnimeDock items={mockItems} />);

        expect(screen.getByText('애니메이션 목록')).toBeInTheDocument();
        expect(screen.getByText('Test Anime 1')).toBeInTheDocument();
        expect(screen.getByText('Test Anime 2')).toBeInTheDocument();
    });

    it('sets drag data on drag start', () => {
        const setDataSpy = vi.fn();
        render(<AnimeDock items={mockItems} />);

        // Use querySelector or getByText to find the draggable element
        // Since the text is inside the draggable div, we can find the text and go up or just query by attribute
        const draggableItem = screen.getByText('Test Anime 1').closest('div[draggable="true"]');
        expect(draggableItem).toBeInTheDocument();

        // Create a proper event mock
        const mockEvent = {
            dataTransfer: {
                setData: setDataSpy,
                effectAllowed: '',
            },
        };

        fireEvent.dragStart(draggableItem!, mockEvent);

        expect(setDataSpy).toHaveBeenCalledWith('application/json', JSON.stringify(mockItems[0]));
        // The second call might not happen if the implementation changed, but based on the file content it does.
        expect(setDataSpy).toHaveBeenCalledWith('text/plain', '');
    });
});
