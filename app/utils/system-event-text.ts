interface EventDetail {
  '@odata.type'?: string
  initiator?: { user?: { displayName?: string | null } | null } | null
  [key: string]: unknown
}

function getInitiator(detail: EventDetail) {
  return detail.initiator?.user?.displayName ?? 'Someone'
}

function getMembers(detail: EventDetail) {
  const members = detail.members as Array<{ displayName?: string | null }> | undefined
  if (!members?.length) return 'members'
  return members.map(m => m.displayName ?? 'Unknown').join(', ')
}

function formatIsoDuration(iso: string) {
  // PT13M51S → 13m 51s, PT1H11M16S → 1h 11m 16s, PT57M47.3683704S → 57m 47s
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/)
  if (!m) return iso
  const parts: string[] = []
  if (m[1]) parts.push(`${m[1]}h`)
  if (m[2]) parts.push(`${m[2]}m`)
  if (m[3]) parts.push(`${Math.round(Number(m[3]))}s`)
  return parts.join(' ') || iso
}

export interface SystemEventInfo {
  text: string
  link?: { url: string; label: string }
}

export function getSystemEventInfo(eventDetail: Record<string, unknown> | null | undefined): SystemEventInfo | null {
  if (!eventDetail) return null

  const detail = eventDetail as EventDetail
  const odata = detail['@odata.type'] ?? ''
  const type = odata.replace('#microsoft.graph.', '')

  if (type === '' || type === odata) {
    console.warn('[eventDetail] Missing or malformed @odata.type:', JSON.stringify(eventDetail))
  }

  const who = getInitiator(detail)

  switch (type) {
    case 'membersAddedEventMessageDetail':
      return { text: `${who} added ${getMembers(detail)}` }
    case 'membersDeletedEventMessageDetail':
      return { text: `${who} removed ${getMembers(detail)}` }
    case 'membersJoinedEventMessageDetail':
      return { text: `${getMembers(detail)} joined` }
    case 'membersLeftEventMessageDetail':
      return { text: `${getMembers(detail)} left` }
    case 'chatRenamedEventMessageDetail':
      return { text: `${who} renamed the chat to "${detail.chatDisplayName ?? 'untitled'}"` }
    case 'channelRenamedEventMessageDetail':
      return { text: `${who} renamed the channel to "${(detail as Record<string, unknown>).channelDisplayName ?? 'untitled'}"` }
    case 'callStartedEventMessageDetail': {
      const eventType = detail.callEventType as string | undefined
      return { text: eventType === 'meeting' ? 'Meeting started' : `${who} started a call` }
    }
    case 'callEndedEventMessageDetail': {
      const duration = detail.callDuration as string | undefined
      const durationStr = duration ? ` — ${formatIsoDuration(duration)}` : ''
      return { text: `Call ended${durationStr}` }
    }
    case 'callRecordingEventMessageDetail': {
      const status = detail.callRecordingStatus as string | undefined
      if (status === 'success' && typeof detail.callRecordingUrl === 'string') {
        return { text: 'Call recording available', link: { url: detail.callRecordingUrl, label: 'Open recording' } }
      }
      if (status === 'initial') {
        return { text: 'Recording started' }
      }
      if (status === 'chunkFinished') {
        return null
      }
      return { text: 'Call recording processing' }
    }
    case 'callTranscriptEventMessageDetail':
      return { text: 'Call transcript available' }
    case 'messagePinnedEventMessageDetail':
      return { text: `${who} pinned a message` }
    case 'messageUnpinnedEventMessageDetail':
      return { text: `${who} unpinned a message` }
    case 'channelAddedEventMessageDetail':
      return { text: `${who} created channel "${(detail as Record<string, unknown>).channelDisplayName ?? 'untitled'}"` }
    case 'channelDeletedEventMessageDetail':
      return { text: `${who} deleted channel "${(detail as Record<string, unknown>).channelDisplayName ?? 'untitled'}"` }
    case 'channelDescriptionUpdatedEventMessageDetail':
      return { text: `${who} updated the channel description` }
    case 'teamRenamedEventMessageDetail':
      return { text: `${who} renamed the team to "${(detail as Record<string, unknown>).teamDisplayName ?? 'untitled'}"` }
    case 'teamCreatedEventMessageDetail':
      return { text: `${who} created the team` }
    case 'teamArchivedEventMessageDetail':
      return { text: `${who} archived the team` }
    case 'teamUnarchivedEventMessageDetail':
      return { text: `${who} unarchived the team` }
    case 'conversationMemberRoleUpdatedEventMessageDetail': {
      const roles = (detail as Record<string, unknown>).conversationMemberRoles as string[] | undefined
      return { text: `${who} updated member role${roles ? ` to ${roles.join(', ')}` : ''}` }
    }
    default:
      console.warn('[eventDetail] Unhandled type:', type, JSON.stringify(eventDetail))
      return { text: 'System event' }
  }
}


