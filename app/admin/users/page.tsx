'use client'

import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { api } from '@/lib/api/client'
import { Check, X, Loader2 } from 'lucide-react'

// Define the User type
interface PendingUser {
  id: string
  name: string
  email: string
  department: string | null
  createdAt: string
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null)
  const [modalAction, setModalAction] = useState<'approve' | 'reject' | null>(null)

  const usersQuery = useInfiniteQuery({
    queryKey: ['admin-pending-users'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await api.get('/admin/users', { params: { status: 'pending', cursor: pageParam, limit: 20 } })
      return res.data
    },
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
  })

  const users = usersQuery.data?.pages.flatMap((page) => page.data) ?? []
  const totalUsers = usersQuery.data?.pages[0]?.meta?.total ?? 0

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await api.patch(`/admin/users/${userId}/approve`)
    },
    onSuccess: () => {
      toast.success('User approved successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-pending-users'] })
      closeModal()
    },
    onError: () => {
      toast.error('Failed to approve user')
    }
  })

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await api.delete(`/admin/users/${userId}/reject`)
    },
    onSuccess: () => {
      toast.success('User rejected and removed')
      queryClient.invalidateQueries({ queryKey: ['admin-pending-users'] })
      closeModal()
    },
    onError: () => {
      toast.error('Failed to reject user')
    }
  })

  const openModal = (user: PendingUser, action: 'approve' | 'reject') => {
    setSelectedUser(user)
    setModalAction(action)
  }

  const closeModal = () => {
    setSelectedUser(null)
    setModalAction(null)
  }

  const handleConfirm = () => {
    if (!selectedUser || !modalAction) return
    if (modalAction === 'approve') {
      approveMutation.mutate(selectedUser.id)
    } else {
      rejectMutation.mutate(selectedUser.id)
    }
  }

  return (
    <div className="p-6 page-enter">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-[--ink-primary]">Pending Registrations</h1>
        <p className="text-[--ink-secondary] text-sm mt-1">Review and approve new department user accounts.</p>
      </div>

      <div className="bg-white rounded-xl border border-[--border-default] overflow-hidden shadow-sm">
        {usersQuery.isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-[--ink-secondary]" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[--ink-secondary]">No pending user registrations at the moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[--bg-canvas] border-b border-[--border-default] text-[--ink-secondary]">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Department</th>
                  <th className="px-6 py-4 font-medium">Registered Date</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[--bg-canvas] transition-colors">
                    <td className="px-6 py-4 text-[--ink-primary] font-medium">{user.name}</td>
                    <td className="px-6 py-4 text-[--ink-secondary]">{user.email}</td>
                    <td className="px-6 py-4 text-[--ink-secondary]">{user.department || '-'}</td>
                    <td className="px-6 py-4 text-[--ink-secondary]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => openModal(user, 'approve')}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          title="Approve User"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openModal(user, 'reject')}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Reject User"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {users.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0 sm:space-x-3 text-sm text-[--ink-secondary]">
          <div>
            Showing {users.length} of {totalUsers} pending users
          </div>
          {usersQuery.hasNextPage && (
            <button
              onClick={() => usersQuery.fetchNextPage()}
              disabled={usersQuery.isFetchingNextPage}
              className="px-4 py-2 border border-[--border-default] rounded-md font-medium hover:bg-[--bg-subtle] disabled:opacity-50"
            >
              {usersQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedUser && modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-lg border border-[--border-default] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-medium text-[--ink-primary]">
                {modalAction === 'approve' ? 'Approve Registration' : 'Reject Registration'}
              </h3>
              <p className="mt-2 text-sm text-[--ink-secondary]">
                Are you sure you want to {modalAction} the account request for <span className="font-medium text-[--ink-primary]">{selectedUser.name}</span>?
                {modalAction === 'reject' && ' This action cannot be undone and the request will be removed.'}
              </p>
            </div>
            <div className="px-6 py-4 bg-[--bg-canvas] border-t border-[--border-default] flex justify-end space-x-3">
              <button
                onClick={closeModal}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-[--ink-secondary] hover:text-[--ink-primary] transition-colors border border-[--border-default] rounded-md hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors flex items-center space-x-2 ${
                  modalAction === 'approve' 
                    ? 'bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2' 
                    : 'bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                } disabled:opacity-50`}
              >
                {(approveMutation.isPending || rejectMutation.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
