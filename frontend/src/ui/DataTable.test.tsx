import React from 'react';
import { render, screen } from '@testing-library/react';

import { DataTable } from './index';

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
});
