'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { StatusBadge } from '@/components/ui/status-badge'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default function RequestsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['user-requests-all'],
    queryFn: async () => {
      const res = await api.get('/user/requests')
      return res.data.data
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">My Requests</h1>
        <p className="text-[--ink-secondary] text-sm">View and track your inventory requests</p>
      </div>

      <div className="bg-white rounded-lg border border-[--border-default] overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
          </div>
        ) : data?.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[--ink-tertiary] mb-2">You haven't made any requests yet.</p>
            <Link href="/inventory" className="text-black font-medium hover:underline">
              Browse inventory
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                <tr>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">ID</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Items</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Date</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Status</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {data?.map((req: any) => (
                  <tr key={req.id} className="hover:bg-[--bg-canvas] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-[--ink-secondary]">
                      {req.id.split('-')[0]}...
                    </td>
                    <td className="px-6 py-4 font-medium text-[--ink-primary]">
                      {req.items?.length > 0 ? req.items[0].item.name : 'Unknown Item'}
                      {req.items?.length > 1 && <span className="text-[--ink-secondary] font-normal ml-1">+{req.items.length - 1} more</span>}
                    </td>
                    <td className="px-6 py-4 text-[--ink-secondary]">
                      {formatDate(req.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/requests/${req.id}`}
                        className="text-black font-medium hover:underline"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
