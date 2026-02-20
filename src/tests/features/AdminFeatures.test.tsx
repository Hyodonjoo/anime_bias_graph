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
    // Shared Spy Mocks
    const mockSelect = vi.fn();
    const mockInsert = vi.fn();
    const mockUpdate = vi.fn();
    const mockDelete = vi.fn();
    const mockEq = vi.fn();
    const mockOrder = vi.fn();
    const mockSingle = vi.fn();
    const mockNeq = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // 1. Setup Spy Default Returns (Chaining)
        const builder = {
            select: mockSelect,
            insert: mockInsert,
            update: mockUpdate,
            delete: mockDelete,
            eq: mockEq,
            order: mockOrder,
            single: mockSingle,
            neq: mockNeq
        };

        mockInsert.mockReturnValue(builder);
        mockUpdate.mockReturnValue(builder);
        mockDelete.mockReturnValue(builder);
        mockSelect.mockReturnValue(builder);
        mockEq.mockReturnValue(builder);
        mockNeq.mockReturnValue(builder);

        mockSingle.mockResolvedValue({ data: { id: 'new-id' }, error: null });
        mockOrder.mockResolvedValue({ data: [], error: null });

        // 2. Setup supabase.from using these spies
        mockSupabase.from.mockImplementation(() => builder);

        // 3. Customize Logic for specific scenarios
        mockOrder.mockResolvedValue({
            data: [
                { id: 'h1', title: 'History 1', created_at: '2024-01-01' },
                { id: 'h2', title: 'History 2', created_at: '2024-01-02' }
            ],
            error: null
        });

        // Auth Logic
        mockSupabase.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'test-user' } } },
        });
        mockSupabase.auth.onAuthStateChange.mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
        });
    });

    // 14. 관리자 페이지에서 이전 주제를 불러올 수 있다
    it('Feature 14: 관리자 페이지에서 이전 주제를 불러올 수 있다', async () => {
        // Customize mockEq to return specific theme for ID 'h1'
        mockEq.mockImplementation((col, val) => {
            if (col === 'id' && val === 'h1') {
                return {
                    single: vi.fn().mockResolvedValue({
                        data: { id: 'h1', title: 'History 1', axis_top: 'T', axis_bottom: 'B', axis_left: 'L', axis_right: 'R' },
                        error: null
                    })
                };
            }
            // For Items fetch: supabase.from('anime_items').select('*').eq('theme_id', 'h1')
            if (col === 'theme_id' && val === 'h1') {
                return Promise.resolve({ data: [], error: null });
            }
            return { single: vi.fn().mockResolvedValue({ data: null }) };
        });

        render(<AdminPage />);
        await waitFor(() => expect(screen.getByText('History 1 (2024. 1. 1.)')).toBeInTheDocument());

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'h1' } });

        await waitFor(() => {
            const themeLabel = screen.getByText('주제 (필수)');
            const input = themeLabel.nextElementSibling as HTMLInputElement;
            expect(input.value).toBe('History 1');
        });
    });

    // 15. 새로운 주제 생성 (Create)
    it('Feature 15: 새로운 주제를 생성하고 저장할 수 있다', async () => {
        render(<AdminPage />);

        const titleInput = await screen.findByPlaceholderText('주제 제목을 입력하세요');
        fireEvent.change(titleInput, { target: { value: 'New Theme 2024' } });

        const saveNewBtn = screen.getByText('주제 업데이트 (미적용)');

        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });

        fireEvent.click(saveNewBtn);

        await waitFor(() => {
            expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
                title: 'New Theme 2024',
                is_active: false
            }));
            expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('변경이 완료되었습니다.'));
        });

        confirmSpy.mockRestore();
        alertSpy.mockRestore();
    });

    // 16. 주제 업데이트 (Update)
    it('Feature 16: 기존 주제를 수정하고 업데이트할 수 있다', async () => {
        mockEq.mockImplementation((col, val) => {
            if (col === 'id' && val === 'h1') {
                return {
                    single: vi.fn().mockResolvedValue({
                        data: { id: 'h1', title: 'History 1', axis_top: 'T', axis_bottom: 'B', axis_left: 'L', axis_right: 'R' },
                        error: null
                    })
                };
            }
            if (col === 'theme_id') return Promise.resolve({ data: [], error: null });
            return { single: vi.fn().mockResolvedValue({ data: null }) };
        });

        render(<AdminPage />);
        await waitFor(() => screen.getByText('History 1 (2024. 1. 1.)'));

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'h1' } });
        await waitFor(() => expect(screen.getByDisplayValue('History 1')).toBeInTheDocument());

        const titleInput = screen.getByDisplayValue('History 1');
        fireEvent.change(titleInput, { target: { value: 'History 1 Updated' } });

        const updateBtn = screen.getByText('주제 업데이트 및 적용');

        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });

        fireEvent.click(updateBtn);

        await waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                title: 'History 1 Updated',
                is_active: true
            }));
            expect(mockDelete).toHaveBeenCalled();
            expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('성공적으로 저장 및 적용되었습니다'));
        });

        confirmSpy.mockRestore();
        alertSpy.mockRestore();
    });

    // 17. 주제 삭제 (Delete)
    it('Feature 17: 주제를 삭제할 수 있다', async () => {
        mockEq.mockImplementation((col, val) => {
            if (col === 'id' && val === 'h1') {
                return {
                    single: vi.fn().mockResolvedValue({
                        data: { id: 'h1', title: 'History 1' },
                        error: null
                    })
                };
            }
            if (col === 'theme_id') return Promise.resolve({ data: [], error: null });
            return { single: vi.fn().mockResolvedValue({ data: null }) };
        });

        render(<AdminPage />);
        await waitFor(() => screen.getByText('History 1 (2024. 1. 1.)'));

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'h1' } });
        await waitFor(() => screen.getByDisplayValue('History 1'));

        const deleteBtn = screen.getByTitle('Delete this history');

        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });

        fireEvent.click(deleteBtn);

        await waitFor(() => {
            // Expect delete calls (one for items, one for theme)
            // Ideally check args, but call count > 0 is a good start
            expect(mockDelete).toHaveBeenCalled();
            expect(alertSpy).toHaveBeenCalledWith('주제가 삭제되었습니다.');
        });

        confirmSpy.mockRestore();
        alertSpy.mockRestore();
    });

});
