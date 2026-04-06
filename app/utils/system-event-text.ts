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
    case 'callStartedEventMessageDetail':
      return `${who} started a call`
    case 'callEndedEventMessageDetail': {
      const duration = (detail as Record<string, unknown>).callDuration as string | undefined
      return duration ? `Call ended (${duration})` : 'Call ended'
    }
    case 'callRecordingEventMessageDetail':
      return `Call recording available`
    case 'callTranscriptEventMessageDetail':
      return `Call transcript available`
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
