import { API } from 'api';

import { getServerTestUsersQuery } from './auth';

describe('auth service', () => {
    test('builds server test users request shape', () => {
        expect(getServerTestUsersQuery()).toEqual({
            url: API.AUTH.TEST_USERS(),
            method: 'POST',
        });
    });

    test('builds Feishu auth endpoint paths', () => {
        expect(API.AUTH.FEISHU.INFO()).toBe(`${API.AUTH.BASE()}/feishu/info`);
        expect(API.AUTH.FEISHU.AUTHORIZE()).toBe(`${API.AUTH.BASE()}/feishu/authorize`);
        expect(API.AUTH.FEISHU.CALLBACK()).toBe(`${API.AUTH.BASE()}/feishu/callback`);
    });

    test('supports the three test login roles', () => {
        const roles: TServerTestUserRole[] = ['global_admin', 'project_manager', 'user'];

        expect(roles).toEqual(['global_admin', 'project_manager', 'user']);
    });
});
