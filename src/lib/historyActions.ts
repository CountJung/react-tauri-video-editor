import { useHistoryStore } from '@/store/historyStore'
import { useProjectStore } from '@/store/projectStore'

function markDirtyWhenChanged(changed: boolean): boolean {
  if (changed) {
    useProjectStore.getState().markDirty()
  }
  return changed
}

export function undoWithDirty(): boolean {
  return markDirtyWhenChanged(useHistoryStore.getState().undo())
}

export function redoWithDirty(): boolean {
  return markDirtyWhenChanged(useHistoryStore.getState().redo())
}

export function jumpToUndoIndexWithDirty(index: number): boolean {
  return markDirtyWhenChanged(useHistoryStore.getState().jumpToUndoIndex(index))
}
