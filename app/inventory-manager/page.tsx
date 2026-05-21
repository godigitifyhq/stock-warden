'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Package, AlertTriangle, XCircle, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const LOW_STOCK_THRESHOLD = 20
const PAGE_SIZE = 50

export default function InventoryManagerDashboard() {
  const inventoryQuery = useInfiniteQuery({
    queryKey: ['im-inventory-all'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await api.get('/admin/inventory', {
        params: { limit: PAGE_SIZE, cursor: pageParam },
      })
      return res.data
    },
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
    staleTime: 2 * 60 * 1000,
  })

  // Auto-fetch remaining pages so stats cover the whole catalog
  useEffect(() => {
    if (inventoryQuery.hasNextPage && !inventoryQuery.isFetchingNextPage) {
      inventoryQuery.fetchNextPage()
    }
  }, [inventoryQuery.hasNextPage, inventoryQuery.isFetchingNextPage, inventoryQuery.fetchNextPage])

  const stats = useMemo(() => {
    const items: any[] = inventoryQuery.data?.pages.flatMap((p) => p.data) ?? []
    const seen = new Set<string>()
    const unique = items.filter((i) => {
      if (!i?.id || seen.has(i.id)) return false
      seen.add(i.id)
      return true
    })
    const active = unique.filter((i) => i.isActive && !i.isStale)
    return {
      total: active.length,
      lowStock: active.filter((i) => i.availableQty > 0 && i.availableQty < LOW_STOCK_THRESHOLD).length,
      outOfStock: active.filter((i) => i.availableQty === 0).length,
      recent: [...unique]
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .slice(0, 10),
    }
  }, [inventoryQuery.data])

  const isLoading = inventoryQuery.isLoading

  if (isLoading) {
    return (
      <div className="p-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    )
  }

  return (
    <div className="space-y-8 page-enter">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-display font-bold">Inventory Dashboard</h1>
          <p className="text-sm text-[--ink-secondary]">Overview of current stock levels</p>
        </div>
        <Link
          href="/inventory-manager/items/new"
          className="inline-flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[--accent-hover] transition-colors"
        >
          <Plus size={16} />
          <span>Add New Item</span>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[--border-default] rounded-lg p-5 shadow-sm">
          <div className="flex items-center space-x-3">
            <Package size={20} className="text-[--ink-secondary]" />
            <span className="text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider">Total Items</span>
          </div>
          <p className="mt-3 text-3xl font-display font-bold">{stats.total}</p>
          <p className="mt-1 text-xs text-[--ink-secondary]">Active, non-stale items</p>
        </div>

        <div className="bg-white border border-amber-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center space-x-3">
            <AlertTriangle size={20} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Low Stock</span>
          </div>
          <p className="mt-3 text-3xl font-display font-bold text-amber-700">{stats.lowStock}</p>
          <p className="mt-1 text-xs text-amber-600">Below {LOW_STOCK_THRESHOLD} units</p>
        </div>

        <div className="bg-white border border-red-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center space-x-3">
            <XCircle size={20} className="text-red-600" />
            <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Out of Stock</span>
          </div>
          <p className="mt-3 text-3xl font-display font-bold text-red-700">{stats.outOfStock}</p>
          <p className="mt-1 text-xs text-red-600">Zero available quantity</p>
        </div>
      </div>

      {/* Recent additions */}
      <div className="bg-white border border-[--border-default] rounded-lg shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[--border-default]">
          <h2 className="font-semibold text-[--ink-primary]">Recent Additions</h2>
        </div>
        {stats.recent.length === 0 ? (
          <p className="p-6 text-sm text-[--ink-secondary] text-center">No items yet.</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
              <tr>
                <th className="px-5 py-3 font-medium text-[--ink-secondary]">Item</th>
                <th className="px-5 py-3 font-medium text-[--ink-secondary]">Category</th>
                <th className="px-5 py-3 font-medium text-[--ink-secondary] text-right">Qty</th>
                <th className="px-5 py-3 font-medium text-[--ink-secondary]">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border-default]">
              {stats.recent.map((item: any) => (
                <tr key={item.id} className="hover:bg-[--bg-canvas] transition-colors">
                  <td className="px-5 py-3 font-medium">
                    <Link href={`/inventory-manager/items/${item.id}`} className="hover:underline">
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-[--ink-secondary]">{item.category ?? '-'}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={item.availableQty === 0 ? 'text-red-600 font-medium' : ''}>
                      {item.availableQty}
                    </span>
                    <span className="text-[--ink-secondary] ml-1">{item.unit}</span>
                  </td>
                  <td className="px-5 py-3 text-[--ink-secondary]">{formatDate(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
