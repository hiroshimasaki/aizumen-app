const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
    });
    page.on('pageerror', error => console.log('PAGE ERROR (Crash):', error.message));

    try {
        await page.goto('http://localhost:5175/signup', { waitUntil: 'networkidle0' });

        console.log('Registering new user...');

        // Instead of using names, let's use the input indexes since it's a simple form
        const inputs = await page.$$('input');
        await inputs[0].type('Test Company');
        await inputs[1].type('Test User');
        const randomEmail = `test${Date.now()}@aizumen.local`;
        await inputs[2].type(randomEmail);
        await inputs[3].type('password123');

        await page.click('button[type="submit"]');

        console.log('Waiting for login redirect...');
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 8000 }).catch(() => { });
        console.log('Current URL:', page.url());

        // Check if there is an error overlay or text
        const bodyText = await page.evaluate(() => document.body.innerText);
        console.log('Body Text length:', bodyText.length);
        if (bodyText.length < 500) {
            console.log('Body Text preview:', bodyText);
        }

        // Wait a bit to capture any async React crashes
        await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
        console.log('SCRIPT ERR:', err.message);
    }

    await browser.close();
})();
