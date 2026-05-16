import { API } from 'api';

describe('admin OAuth service', () => {
    test('builds Feishu OAuth settings endpoint paths', () => {
        expect(API.ADMIN_OAUTH.FEISHU.GET()).toBe(`${API.BASE()}/admin/oauth/feishu/get`);
        expect(API.ADMIN_OAUTH.FEISHU.UPDATE()).toBe(`${API.BASE()}/admin/oauth/feishu/update`);
    });
});
