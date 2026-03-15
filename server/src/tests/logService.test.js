jest.mock('../config/supabase', () => ({
    supabaseAdmin: {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ error: null })
    }
}));

const logService = require('../services/logService');

describe('LogService', () => {
    let consoleLogSpy, consoleErrorSpy, consoleWarnSpy;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('maskSensitiveData', () => {
        it('should mask sensitive keys', () => {
            const input = {
                username: 'alice',
                password: 'secret_password',
                nested: {
                    token: 'secret_token',
                    active: true
                },
                list: [{ secret: 'shh' }, { name: 'bob' }]
            };

            const expected = {
                username: 'alice',
                password: '***',
                nested: {
                    token: '***',
                    active: true
                },
                list: [{ secret: '***' }, { name: 'bob' }]
            };

            expect(logService.maskSensitiveData(input)).toEqual(expected);
        });

        it('should handle non-object inputs', () => {
            expect(logService.maskSensitiveData('string')).toBe('string');
            expect(logService.maskSensitiveData(123)).toBe(123);
            expect(logService.maskSensitiveData(null)).toBe(null);
        });
    });

    describe('level-based output', () => {
        it('info should always log to console', () => {
            logService.info('test info');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('[INFO]'),
                ''
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('test info'),
                ''
            );
        });

        it('warn should always log to console.warn', () => {
            logService.warn('test warn');
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('[WARN]'),
                ''
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('test warn'),
                ''
            );
        });

        it('debug should log only when isDev is true', () => {
            logService.isDev = true;
            logService.debug('test debug');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('[DEBUG]'),
                ''
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('test debug'),
                ''
            );

            consoleLogSpy.mockClear();
            logService.isDev = false;
            logService.debug('test debug shadow');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });
});
