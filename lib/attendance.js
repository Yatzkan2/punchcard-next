export function shouldPunch({ draftStatus, alreadyPunched, punchAnyway }) {
  if (alreadyPunched) return false
  if (draftStatus === 'attended') return true
  if (draftStatus === 'absent' && punchAnyway) return true
  return false
}

export function shouldCreateDebt({ shouldPunch, hasPassRemaining }) {
  return shouldPunch === true && hasPassRemaining === false
}
