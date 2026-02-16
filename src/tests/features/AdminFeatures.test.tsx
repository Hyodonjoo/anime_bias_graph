import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminPage from '@/app/studio-panel-x9z2/page';

// Mock Supabase Client
const { mockSupabase } = vi.hoisted(() => {
    return {
        mockSupabase: {
            auth: {
                getSession: vi.fn(),
                onAuthStateChange: vi.fn(),
                signInWithPassword: vi.fn(),
                signOut: vi.fn(),
            },
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

// Mock child components to avoid complex rendering in unit/integration tests
vi.mock('@/components/AnimeGrid', () => ({
    default: ({ axisLabels }: { axisLabels: { top: string } }) => (
        <div data-testid="anime-grid">
            Grid
            <span data-testid="axis-top">{axisLabels?.top}</span>
        </div>
    ),
}));
vi.mock('@/components/AnimeDock', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: ({ items }: { items: any[] }) => <div data-testid="anime-dock">Dock Items: {items.length}</div>,
}));

// Mock Next/Image etc if needed, though we mocked components using them
vi.mock('next/image', () => ({
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text, @typescript-eslint/no-explicit-any
    default: (props: any) => <img {...props} />,
}));


describe('AdminPage Features', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default Auth Setup: Authenticated
        mockSupabase.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'test-user' } } },
        });
        mockSupabase.auth.onAuthStateChange.mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
        });

        // Default Data Mocks
        const mockSelect = vi.fn(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result: any = Promise.resolve({ data: [], error: null });

            // Allow chaining .order()
            result.order = vi.fn().mockReturnValue({ data: [], error: null });

            // Allow chaining .eq()
            result.eq = vi.fn().mockImplementation(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const eqResult: any = Promise.resolve({
                    data: [], // Default for anime_items list
                    error: null
                });

                // Allow chaining .single() on eq result
                eqResult.single = vi.fn().mockResolvedValue({
                    data: { id: 'h1', title: 'History 1', axis_top: 'T', axis_bottom: 'B', axis_left: 'L', axis_right: 'R' },
                    error: null
                });

                return eqResult;
            });

            return result;
        });

        mockSupabase.from.mockReturnValue({
            select: mockSelect,
            insert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        });
    });

    // 14. 관리자 페이지에서 이전에 선정한 주제를 불러오거나 수정, 삭제가 가능한가?
    it('Feature 14: 관리자 페이지에서 이전 주제를 불러올 수 있다', async () => {
        // Mock History Data
        const historyData = [
            { id: 'h1', title: 'History 1', created_at: '2024-01-01' },
            { id: 'h2', title: 'History 2', created_at: '2024-01-02' }
        ];

        const mockSelect = vi.fn(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result: any = Promise.resolve({ data: [], error: null });

            // Allow chaining .order()
            result.order = vi.fn().mockReturnValue({ data: historyData, error: null });

            // Allow chaining .eq()
            result.eq = vi.fn().mockImplementation(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const eqResult: any = Promise.resolve({
                    data: [], // Default for anime_items list
                    error: null
                });

                // Allow chaining .single() on eq result
                eqResult.single = vi.fn().mockResolvedValue({
                    data: { id: 'h1', title: 'History 1', axis_top: 'T', axis_bottom: 'B', axis_left: 'L', axis_right: 'R' },
                    error: null
                });

                return eqResult;
            });

            return result;
        });

        mockSupabase.from.mockReturnValue({ select: mockSelect });

        render(<AdminPage />);
        await waitFor(() => expect(screen.getByText('History 1 (2024. 1. 1.)')).toBeInTheDocument());

        // Select option
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'h1' } });

        // Should trigger loadThemeHistory -> fetch theme details
        await waitFor(() => {
            // Theme Input should now be "History 1"
            const themeLabel = screen.getByText('주제');
            const input = themeLabel.nextElementSibling as HTMLInputElement;
            expect(input.value).toBe('History 1');
        });
    });

});
