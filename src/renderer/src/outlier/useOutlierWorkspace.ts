import { useEffect, useState } from 'react'
import { defaultOutlierData, insertionLocked, type OutlierData, type InsertionStatus, type OutlierSetup } from '../../../shared/outlier'

export function useOutlierWorkspace() {
  const [data, setData] = useState<OutlierData>(defaultOutlierData)
  const [loaded, setLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState('s2s')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [models, setModels] = useState<Record<string, 'A' | 'B'>>({})
  const [tab, setTab] = useState<'voice' | 'rationale'>('rationale')
  const [showArchived, setShowArchived] = useState(false)
  const [status, setStatus] = useState<InsertionStatus | null>(null)
  const [setup, setSetup] = useState<OutlierSetup | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let mounted = true
    const unsubscribe = window.neb.onInsertionStatus((next) => { if (mounted) setStatus(next) })
    void window.neb.getOutlierData().then((next) => { if (mounted) { setData(next); setLoaded(true) } }).catch((reason) => { if (mounted) setError(String(reason)) })
    void window.neb.getInsertionStatus().then((next) => { if (mounted) setStatus(next) }).catch((reason) => { if (mounted) setError(String(reason)) })
    void window.neb.getOutlierSetup().then((next) => { if (mounted) setSetup(next) }).catch((reason) => { if (mounted) setError(String(reason)) })
    return () => { mounted = false; unsubscribe() }
  }, [])
  const locked = Boolean(status && insertionLocked(status))
  async function save(next: OutlierData): Promise<boolean> {
    if (saving || locked || !loaded) return false
    setSaving(true); setError('')
    try { setData(await window.neb.saveOutlierData(next)); return true }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); return false }
    finally { setSaving(false) }
  }
  async function action(operation: () => Promise<unknown>): Promise<void> {
    setError('')
    try { await operation() } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  return { data, loaded, selectedId, setSelectedId, drafts, setDrafts, models, setModels, tab, setTab, showArchived, setShowArchived, status, setup, setSetup, error, saving, locked, save, action }
}
export type OutlierWorkspace = ReturnType<typeof useOutlierWorkspace>
