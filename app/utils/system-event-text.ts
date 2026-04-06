interface EventDetail {
  '@odata.type'?: string
  initiator?: { user?: { displayName?: string | null } | null } | null
  [key: string]: unknown
}

function getInitiator(detail: EventDetail): string {
  return detail.initiator?.user?.displayName ?? 'Someone'
}

function getMembers(detail: EventDetail): string {
  const members = detail.members as Array<{ displayName?: string | null }> | undefined
  if (!members?.length) return 'members'
  return members.map(m => m.displayName ?? 'Unknown').join(', ')
}

function formatIsoDuration(iso: string): string {
  // PT13M51S → 13m 51s, PT1H11M16S → 1h 11m 16s, PT57M47.3683704S → 57m 47s
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/)
  if (!m) return iso
  const parts: string[] = []
  if (m[1]) parts.push(`${m[1]}h`)
  if (m[2]) parts.push(`${m[2]}m`)
  if (m[3]) parts.push(`${Math.round(Number(m[3]))}s`)
  return parts.join(' ') || iso
}

function getCallParticipantNames(detail: EventDetail): string[] {
  const participants = detail.callParticipants as Array<{ participant?: { user?: { displayName?: string | null; application?: { applicationIdentityType?: string | null } } | null } }> | undefined
  if (!participants?.length) return []
  return participants
    .map(p => p.participant?.user?.displayName)
    .filter((name): name is string => !!name && name.length > 0)
}

export function getSystemEventText(eventDetail: Record<string, unknown> | null | undefined): string | null {
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
      return `${who} added ${getMembers(detail)}`
    case 'membersDeletedEventMessageDetail':
      return `${who} removed ${getMembers(detail)}`
    case 'membersJoinedEventMessageDetail':
      return `${getMembers(detail)} joined`
    case 'membersLeftEventMessageDetail':
      return `${getMembers(detail)} left`
    case 'chatRenamedEventMessageDetail':
      return `${who} renamed the chat to "${detail.chatDisplayName ?? 'untitled'}"`
    case 'channelRenamedEventMessageDetail':
      return `${who} renamed the channel to "${(detail as Record<string, unknown>).channelDisplayName ?? 'untitled'}"`
    case 'callStartedEventMessageDetail': {
      const eventType = detail.callEventType as string | undefined
      return eventType === 'meeting' ? `${who} started a meeting` : `${who} started a call`
    }
    case 'callEndedEventMessageDetail': {
      const duration = detail.callDuration as string | undefined
      const participants = getCallParticipantNames(detail)
      const durationStr = duration ? ` — ${formatIsoDuration(duration)}` : ''
      const participantStr = participants.length > 0
        ? ` (${participants.join(', ')})`
        : ''
      return `Call ended${participantStr}${durationStr}`
    }
    case 'callRecordingEventMessageDetail': {
      const status = detail.callRecordingStatus as string | undefined
      if (status === 'success' && detail.callRecordingUrl) {
        return 'Call recording available'
      }
      if (status === 'chunkFinished' || status === 'initial') {
        return null
      }
      return 'Call recording processing'
    }
    case 'callTranscriptEventMessageDetail':
      return 'Call transcript available'
    case 'messagePinnedEventMessageDetail':
      return `${who} pinned a message`
    case 'messageUnpinnedEventMessageDetail':
      return `${who} unpinned a message`
    case 'channelAddedEventMessageDetail':
      return `${who} created channel "${(detail as Record<string, unknown>).channelDisplayName ?? 'untitled'}"`
    case 'channelDeletedEventMessageDetail':
      return `${who} deleted channel "${(detail as Record<string, unknown>).channelDisplayName ?? 'untitled'}"`
    case 'channelDescriptionUpdatedEventMessageDetail':
      return `${who} updated the channel description`
    case 'teamRenamedEventMessageDetail':
      return `${who} renamed the team to "${(detail as Record<string, unknown>).teamDisplayName ?? 'untitled'}"`
    case 'teamCreatedEventMessageDetail':
      return `${who} created the team`
    case 'teamArchivedEventMessageDetail':
      return `${who} archived the team`
    case 'teamUnarchivedEventMessageDetail':
      return `${who} unarchived the team`
    case 'conversationMemberRoleUpdatedEventMessageDetail': {
      const roles = (detail as Record<string, unknown>).conversationMemberRoles as string[] | undefined
      return `${who} updated member role${roles ? ` to ${roles.join(', ')}` : ''}`
    }
    default:
      console.warn('[eventDetail] Unhandled type:', type, JSON.stringify(eventDetail))
      return 'System event'
  }
}
