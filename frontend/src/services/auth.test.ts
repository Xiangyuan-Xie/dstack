import { API } from 'api';

import { getServerTestUsersQuery } from './auth';

describe('auth service', () => {
    test('builds server test users request shape', () => {
        expect(getServerTestUsersQuery()).toEqual({
            url: API.AUTH.TEST_USERS(),
            method: 'POST',
        });
    });

    test('supports the three test login roles', () => {
        const roles: TServerTestUserRole[] = ['global_admin', 'project_manager', 'user'];

        expect(roles).toEqual(['global_admin', 'project_manager', 'user']);
    });
});
