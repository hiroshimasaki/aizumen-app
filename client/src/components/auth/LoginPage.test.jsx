import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { useAuth } from '../../contexts/AuthContext';

// モックの設定
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('LoginPage Component', () => {
    const mockSignInWithCode = vi.fn();
    const mockSignIn = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({
            signInWithCode: mockSignInWithCode,
            signIn: mockSignIn,
        });
    });

    it('renders employee login mode by default', () => {
        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>
        );

        expect(screen.getByText('AiZumen')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('masaki-tekko')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('001')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    });

    it('switches to admin mode when admin tab is clicked', () => {
        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>
        );

        const adminTab = screen.getByRole('button', { name: '管理者' });
        fireEvent.click(adminTab);

        expect(screen.getByPlaceholderText('admin@example.com')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('masaki-tekko')).not.toBeInTheDocument();
    });

    it('calls signInWithCode and navigates on successful employee login', async () => {
        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('masaki-tekko'), { target: { value: 'test-company' } });
        fireEvent.change(screen.getByPlaceholderText('001'), { target: { value: '123' } });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });

        const submitBtn = screen.getByRole('button', { name: 'ログイン' });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockSignInWithCode).toHaveBeenCalledWith('test-company', '123', 'password123');
            expect(mockNavigate).toHaveBeenCalledWith('/quotations');
        });
    });

    it('displays error message when login fails', async () => {
        mockSignInWithCode.mockRejectedValueOnce(new Error('Invalid credentials'));

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('masaki-tekko'), { target: { value: 'wrong' } });
        fireEvent.change(screen.getByPlaceholderText('001'), { target: { value: '000' } });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });

        const submitBtn = screen.getByRole('button', { name: 'ログイン' });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('会社コード、従業員番号、またはパスワードが間違っています。')).toBeInTheDocument();
        });
    });
});
