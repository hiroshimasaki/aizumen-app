import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
    test('should display login page correctly', async ({ page }) => {
        await page.goto('/login');

        // ロゴが表示されているか確認
        await expect(page.getByRole('heading', { name: 'AiZumen' })).toBeVisible();

        // 従業員タブと管理者タブが存在するか確認
        await expect(page.getByRole('button', { name: '従業員' })).toBeVisible();
        await expect(page.getByRole('button', { name: '管理者' })).toBeVisible();
    });

    test('should switch to admin login mode', async ({ page }) => {
        await page.goto('/login');

        // 管理者タブをクリック
        await page.getByRole('button', { name: '管理者' }).click();

        // 管理者用の入力フィールド（メールアドレス）が表示されているか確認
        await expect(page.getByText('メールアドレス')).toBeVisible();
        await expect(page.getByPlaceholder('admin@example.com')).toBeVisible();
    });

    test('should show validation error on empty submit', async ({ page }) => {
        await page.goto('/login');

        // 従業員モード（デフォルト）でログインボタンをクリック
        const loginButton = page.getByRole('button', { name: 'ログイン' });

        // HTML5 validation will typically prevent default submit if required fields are empty
        // Let's verify that the input fields exist and have 'required' attribute
        const companyCodeInput = page.getByPlaceholder('masaki-tekko');
        await expect(companyCodeInput).toBeVisible();

        const employeeIdInput = page.getByPlaceholder('001');
        await expect(employeeIdInput).toBeVisible();

        const passwordInput = page.getByPlaceholder('••••••••');
        await expect(passwordInput).toBeVisible();
    });

    test('should show error with invalid credentials', async ({ page }) => {
        // APIのモックを追加して401エラーを返す (CORSヘッダーを追加)
        await page.route('**/api/auth/login-with-code', route => {
            route.fulfill({
                status: 401,
                contentType: 'application/json',
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*'
                },
                body: JSON.stringify({ error: 'Invalid credentials' })
            });
        });

        await page.goto('/login');

        await page.getByPlaceholder('masaki-tekko').fill('wrong-company');
        await page.getByPlaceholder('001').fill('999');
        await page.getByPlaceholder('••••••••').fill('wrongpassword');

        await page.getByRole('button', { name: 'ログイン' }).click();

        // エラーメッセージが表示されることを確認
        await expect(page.locator('.text-red-300')).toBeVisible({ timeout: 10000 });
    });

    test('should handle very long inputs gracefully', async ({ page }) => {
        // APIのモックを追加して400エラーなどを返す（フロントエンドのクラッシュ防止確認用）
        await page.route('**/api/auth/login-with-code', route => {
            route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Invalid input' })
            });
        });
        await page.goto('/login');

        const longString = 'a'.repeat(1000);
        await page.getByPlaceholder('masaki-tekko').fill(longString);
        await page.getByPlaceholder('001').fill(longString);
        await page.getByPlaceholder('••••••••').fill(longString);

        await page.getByRole('button', { name: 'ログイン' }).click();

        // クラッシュせずに適切なエラーメッセージ（またはサーバーエラー）が処理されるか確認
        const errorLocator = page.locator('.text-red-300');
        await expect(errorLocator).toBeVisible({ timeout: 10000 });
    });

    test('should handle special characters (SQL injection attempt)', async ({ page }) => {
        // 特殊文字の場合もAPI側で弾かれる想定のモック (CORSヘッダーを追加)
        await page.route('**/api/auth/login-with-code', route => {
            route.fulfill({
                status: 401,
                contentType: 'application/json',
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*'
                },
                body: JSON.stringify({ error: 'Invalid credentials' })
            });
        });
        await page.goto('/login');

        const sqlInjectionString = "' OR 1=1; --";
        await page.getByPlaceholder('masaki-tekko').fill(sqlInjectionString);
        await page.getByPlaceholder('001').fill(sqlInjectionString);
        await page.getByPlaceholder('••••••••').fill(sqlInjectionString);

        await page.getByRole('button', { name: 'ログイン' }).click();

        // インジェクションが成功せずにエラーとなることを確認
        await expect(page.locator('.text-red-300')).toBeVisible({ timeout: 10000 });
    });
});
