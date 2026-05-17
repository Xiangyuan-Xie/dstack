import { API } from 'api';

describe('worker service', () => {
    test('builds worker registration token endpoint paths', () => {
        expect(API.ADMIN_WORKERS.CREATE_TOKEN()).toBe(`${API.BASE()}/admin/worker_tokens/create`);
        expect(API.ADMIN_WORKERS.LIST_TOKENS()).toBe(`${API.BASE()}/admin/worker_tokens/list`);
        expect(API.ADMIN_WORKERS.DELETE_TOKEN()).toBe(`${API.BASE()}/admin/worker_tokens/delete`);
    });
});
