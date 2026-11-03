'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { PublicUser } from '@/lib/auth-schema'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DataTablePagination,
  DataTableToolbar,
  DataTableColumnHeader,
} from '@/components/data-table'

type Props = {
  data: PublicUser[]
  onEdit: (user: PublicUser) => void
  onDelete: (user: PublicUser) => void
}

export function UsersTable({ data, onEdit, onDelete }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])
  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: false },
    columnFilters: [
      { columnId: 'username', searchKey: 'username', type: 'string' },
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'role', searchKey: 'role', type: 'array' },
    ],
  })
  const columns = useMemo<ColumnDef<PublicUser>[]>(
    () => [
      {
        accessorKey: 'username',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='用户名' />
        ),
      },
      {
        accessorKey: 'role',
        header: '角色',
        cell: ({ row }) => (row.original.role === 'admin' ? '管理员' : '用户'),
        filterFn: (row, id, values) => values.includes(row.getValue(id)),
      },
      {
        id: 'status',
        accessorFn: (user) => (user.enabled ? 'active' : 'disabled'),
        header: '状态',
        cell: ({ row }) => (
          <Badge variant={row.original.enabled ? 'secondary' : 'destructive'}>
            {row.original.enabled ? '启用' : '禁用'}
          </Badge>
        ),
        filterFn: (row, id, values) => values.includes(row.getValue(id)),
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='创建时间' />
        ),
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleString('zh-CN'),
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => onEdit(row.original)}
            >
              编辑
            </Button>
            <Button
              variant='ghost'
              size='sm'
              className='text-destructive'
              onClick={() => onDelete(row.original)}
            >
              删除
            </Button>
          </div>
        ),
      },
    ],
    [onEdit, onDelete]
  )
  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination, columnFilters },
    onSortingChange: setSorting,
    onPaginationChange,
    onColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })
  useEffect(() => {
    ensurePageInRange(table.getPageCount())
  }, [table, ensurePageInRange])
  return (
    <div className='flex flex-1 flex-col gap-4'>
      <DataTableToolbar
        table={table}
        searchKey='username'
        searchPlaceholder='搜索用户名…'
        filters={[
          {
            columnId: 'role',
            title: '角色',
            options: [
              { label: '管理员', value: 'admin' },
              { label: '用户', value: 'user' },
            ],
          },
          {
            columnId: 'status',
            title: '状态',
            options: [
              { label: '启用', value: 'active' },
              { label: '禁用', value: 'disabled' },
            ],
          },
        ]}
      />
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  没有符合条件的用户。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
    </div>
  )
}
