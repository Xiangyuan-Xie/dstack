import React from 'react';
import { render, screen } from '@testing-library/react';

import { ConfirmationDialogViewport, DataTable } from './index';

jest.mock('i18next', () => ({
    language: 'zh',
}));

jest.mock('hooks', () => ({
    useAppDispatch: () => jest.fn(),
    useAppSelector: () => [
        {
            uuid: 'dialog-1',
            title: '确认操作',
            content: '确认执行？',
            onDiscard: jest.fn(),
            onConfirm: jest.fn(),
        },
    ],
}));

describe('DataTable', () => {
    test('renders a localized default empty state', () => {
        render(
            <DataTable
                columns={[{ id: 'name', header: '名称', cell: (item: { name: string }) => item.name }]}
                items={[]}
                keyGetter={(item) => item.name}
                emptyTitle="暂无数据"
            />,
        );

        expect(screen.getByText('暂无数据')).toBeInTheDocument();
        expect(screen.queryByText('No data')).not.toBeInTheDocument();
    });

    test('localizes confirmation dialog fallback button labels', () => {
        render(<ConfirmationDialogViewport />);

        expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
});
