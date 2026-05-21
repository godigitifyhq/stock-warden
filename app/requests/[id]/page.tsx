'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Download, XCircle, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'

export default function RequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const requestId = params.id as string
  const [confirmAction, setConfirmAction] = useState<'cancel' | 're-request' | null>(null)

  const { data: req, isLoading } = useQuery({
    queryKey: ['request', requestId],
    queryFn: async () => {
      const res = await api.get(`/user/requests/${requestId}`)
      return res.data.data
    }
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/user/requests/${requestId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] })
      queryClient.invalidateQueries({ queryKey: ['user-requests-all'] })
      toast.success('Request cancelled successfully')
      setConfirmAction(null)
    },
    onError: () => toast.error('Failed to cancel request')
  })

  const reRequestMutation = useMutation({
    mutationFn: () => api.patch(`/user/requests/${requestId}/re-request`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] })
      queryClient.invalidateQueries({ queryKey: ['user-requests-all'] })
      toast.success('Request resubmitted successfully')
      setConfirmAction(null)
    },
    onError: () => toast.error('Failed to resubmit request')
  })

  const handleConfirm = () => {
    if (confirmAction === 'cancel') {
      cancelMutation.mutate()
    } else if (confirmAction === 're-request') {
      reRequestMutation.mutate()
    }
  }

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
  }

  if (!req) return <div className="p-8 text-center text-[--ink-secondary]">Request not found.</div>

  const isCancelable = req.status === 'REQUESTED' || req.status === 'PENDING'
  const isReRequestable = req.status === 'REJECTED'

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link href="/requests" className="inline-flex items-center space-x-2 text-sm font-medium text-[--ink-secondary] hover:text-[--ink-primary]">
        <ArrowLeft size={16} />
        Back to Requests
      </Link>

      <div className="bg-white rounded-lg border border-[--border-default] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[--border-default] flex flex-col md:flex-row justify-between md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div>
            <h1 className="text-xl font-display font-bold">Request Details</h1>
            <p className="text-sm font-mono text-[--ink-secondary] mt-1">ID: {req.id}</p>
          </div>
          <div className="flex items-center space-x-3">
            <StatusBadge status={req.status} />
            
            {req.status === 'APPROVED' && (
              <a 
                href={`/api/user/requests/${req.id}/invoice-download`} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center space-x-2 px-3 py-1.5 bg-black text-white rounded-md font-medium text-sm hover:bg-black hover:text-white transition-colors"
              >
                <Download size={16} />
                Download PDF
              </a>
            )}

            {req.status === 'APPROVED' && (
              <a
                href={`/api/user/requests/${req.id}/receipt-download`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-2 px-3 py-1.5 bg-black border text-white border-[--border-default] rounded-md font-medium text-sm "
              >
                <Download size={16} />
                Download Receipt
              </a>
            )}

            {isCancelable && (
              <button 
                onClick={() => setConfirmAction('cancel')}
                disabled={cancelMutation.isPending || reRequestMutation.isPending}
                className="inline-flex items-center space-x-2 px-3 py-1.5 border border-[--border-default] text-[--ink-secondary] rounded-md font-medium text-sm hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                <XCircle size={16} />
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Request'}
              </button>
            )}

            {isReRequestable && (
              <button 
                onClick={() => setConfirmAction('re-request')}
                disabled={cancelMutation.isPending || reRequestMutation.isPending}
                className="inline-flex items-center space-x-2 px-3 py-1.5 border border-[--border-default] text-[--ink-secondary] rounded-md font-medium text-sm hover:bg-[--accent-primary-bg] hover:text-black transition-colors disabled:opacity-50"
              >
                <RotateCcw size={16} />
                {reRequestMutation.isPending ? 'Resubmitting...' : 'Re-Request'}
              </button>
            )}
          </div>
        </div>

        {/* Stepper Visualization */}
        <div className="p-6 border-b border-[--border-default] bg-[--bg-subtle]">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-10 right-3 top-2 w-[80%] lg:w-[90%] md:w-[90%] sm:w-[85%] h-0.5 bg-black/50 z-0" />
            
            {['REQUESTED', 'PENDING', 'APPROVED'].map((step, idx) => {
              const isPast = 
                (req.status === 'APPROVED' && idx <= 2) || 
                (req.status === 'PENDING' && idx <= 1) || 
                (req.status === 'REQUESTED' && idx === 0) ||
                (req.status === 'REJECTED' && idx === 0) ||
                (req.status === 'CANCELLED' && idx === 0)

              const isCurrent = req.status === step
              
              let dotClass = 'bg-white border-2 border-[--border-default]'
              if (isCurrent) dotClass = 'bg-black border-2 border-black ring-4 ring-[--accent-primary-bg]'
              else if (isPast) dotClass = 'bg-black border-2 border-black'

              if (req.status === 'REJECTED' && step === 'APPROVED') {
                dotClass = 'bg-white border-2 border-red-500'
              }

              return (
                <div key={step} className="relative z-10 flex flex-col items-center space-y-2 bg-[--bg-subtle] px-2">
                  <div className={`w-4 h-4 rounded-full ${dotClass} transition-all`} />
                  <span className={`text-xs font-medium uppercase tracking-wider ${isCurrent || isPast ? 'text-black' : 'text-[--ink-disabled]'}`}>
                    {req.status === 'REJECTED' && step === 'APPROVED' ? 'REJECTED' : step}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[--ink-secondary] uppercase tracking-wider mb-3">Requested Items</h3>
              <div className="border border-[--border-default] rounded-md overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Item</th>
                      <th className="px-4 py-2 font-medium text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border-default]">
                    {req.items.map((ri: any) => (
                      <tr key={ri.id}>
                        <td className="px-4 py-3">{ri.item.name}</td>
                        <td className="px-4 py-3 text-right font-medium">{ri.quantityReq} <span className="font-normal text-[--ink-secondary]">{ri.item.unit}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {req.notes && (
              <div>
                <h3 className="text-sm font-semibold text-[--ink-secondary] uppercase tracking-wider mb-2">User Notes</h3>
                <p className="text-sm bg-[--bg-canvas] p-4 rounded-md border border-[--border-default]">{req.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[--ink-secondary] uppercase tracking-wider mb-3">Details</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[--ink-secondary]">Submitted On</dt>
                  <dd className="font-medium text-right">{formatDate(req.createdAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[--ink-secondary]">Session Year</dt>
                  <dd className="font-medium text-right">{req.sessionYear}</dd>
                </div>
                {req.processedAt && (
                  <div className="flex justify-between">
                    <dt className="text-[--ink-secondary]">Processed On</dt>
                    <dd className="font-medium text-right">{formatDate(req.processedAt)}</dd>
                  </div>
                )}
                {req.invoiceNumber && (
                  <div className="flex justify-between">
                    <dt className="text-[--ink-secondary]">Invoice No.</dt>
                    <dd className="font-mono text-right">{req.invoiceNumber}</dd>
                  </div>
                )}
              </dl>
            </div>

            {req.adminNotes && (
              <div>
                <h3 className="text-sm font-semibold text-[--ink-secondary] uppercase tracking-wider mb-2">Admin Remarks</h3>
                <p className="text-sm bg-amber-50 text-amber-900 p-4 rounded-md border border-amber-200">{req.adminNotes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmAction !== null}
        title={confirmAction === 'cancel' ? 'Cancel Request' : 'Re-request Items'}
        description={
          confirmAction === 'cancel'
            ? 'Cancel this request? You will need to submit a new one if needed later.'
            : 'Re-submit this request for approval again?'
        }
        confirmText={confirmAction === 'cancel' ? 'Cancel Request' : 'Re-Request'}
        isDestructive={confirmAction === 'cancel'}
        isLoading={cancelMutation.isPending || reRequestMutation.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
