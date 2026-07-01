/**
 * TEMPORARY — Connection test component.
 * Remove this file and its import from Dashboard.jsx once the connection is confirmed.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { CheckCircle2, XCircle, Loader2, Database, RefreshCw } from 'lucide-react'

export default function SupabaseTest() {
  const [status, setStatus]           = useState('idle')   // idle | loading | success | error
  const [departments, setDepartments] = useState([])
  const [error, setError]             = useState(null)
  const [latency, setLatency]         = useState(null)

  async function runTest() {
    setStatus('loading')
    setError(null)
    setDepartments([])

    const t0 = performance.now()

    const { data, error } = await supabase
      .from('departments')
      .select('id, name, description, created_at')
      .order('name')

    setLatency(Math.round(performance.now() - t0))

    if (error) {
      setStatus('error')
      setError(error.message)
    } else {
      setStatus('success')
      setDepartments(data)
    }
  }

  useEffect(() => { runTest() }, [])

  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  return (
    <div className="max-w-2xl mb-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2.5">
            <Database size={16} className="text-[#1e3a8a]" />
            <span className="text-sm font-semibold text-gray-800">Supabase Connection Test</span>
            <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              TEMP — remove after testing
            </span>
          </div>
          <button
            onClick={runTest}
            disabled={status === 'loading'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={status === 'loading' ? 'animate-spin' : ''} />
            Re-run
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Env var display */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                VITE_SUPABASE_URL
              </p>
              <p className="text-xs font-mono text-gray-700 break-all">
                {url ?? <span className="text-red-500">⚠ Not set</span>}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                VITE_SUPABASE_ANON_KEY
              </p>
              <p className="text-xs font-mono text-gray-700">
                {key
                  ? `${key.slice(0, 24)}…`
                  : <span className="text-red-500">⚠ Not set</span>}
              </p>
            </div>
          </div>

          {/* Loading */}
          {status === 'loading' && (
            <div className="flex items-center gap-3 py-2 text-gray-500">
              <Loader2 size={18} className="animate-spin text-blue-500" />
              <span className="text-sm">Pinging Supabase…</span>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-lg p-3.5">
              <XCircle size={17} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Connection failed</p>
                <p className="mt-0.5 text-xs font-mono text-red-500 break-all">{error}</p>
                <p className="mt-2 text-xs text-red-400">
                  Check that RLS is enabled and the <code>departments</code> table exists.
                  Run the SQL schema first if you have not done so.
                </p>
              </div>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="space-y-3">
              {/* Status banner */}
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5">
                <CheckCircle2 size={17} className="text-emerald-500 shrink-0" />
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-emerald-700">
                    Connected to Supabase ✓
                  </p>
                  <span className="text-[11px] text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {latency} ms round-trip
                  </span>
                  <span className="text-[11px] text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {departments.length} departments
                  </span>
                </div>
              </div>

              {/* Results table */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  departments table
                </p>
                <div className="rounded-lg border border-gray-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-500 font-medium">Name</th>
                        <th className="text-left px-3 py-2 text-gray-500 font-medium">Description</th>
                        <th className="text-left px-3 py-2 text-gray-500 font-medium">UUID (short)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {departments.map(dept => (
                        <tr key={dept.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-800">{dept.name}</td>
                          <td className="px-3 py-2 text-gray-500">{dept.description ?? '—'}</td>
                          <td className="px-3 py-2 font-mono text-gray-400">{dept.id.slice(0, 8)}…</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
