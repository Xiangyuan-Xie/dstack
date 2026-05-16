import reducer, { markAllRead, push, remove } from './slice';

describe('notifications slice', () => {
    test('tracks unread count separately from visible items', () => {
        const first = reducer(undefined, push({ id: 'n-1', header: 'Saved' }));
        const second = reducer(first, push({ id: 'n-2', header: 'Failed' }));

        expect(second.items).toHaveLength(2);
        expect(second.unreadCount).toBe(2);

        const afterRemove = reducer(second, remove('n-1'));

        expect(afterRemove.items).toHaveLength(1);
        expect(afterRemove.unreadCount).toBe(2);

        const afterRead = reducer(afterRemove, markAllRead());

        expect(afterRead.items).toHaveLength(1);
        expect(afterRead.unreadCount).toBe(0);
    });
});
