export type {
  Chat,
  ChatMessage,
  ChatMessageInfo,
  ChatMessageFromIdentitySet,
  ConversationMember,
  IdentitySet,
  ItemBody,
  EventMessageDetail,
  Channel,
  Team,
  Subscription,
  ChatMessageType,
  ChatType,
  MembersAddedEventMessageDetail,
  MembersDeletedEventMessageDetail,
  MembersJoinedEventMessageDetail,
  MembersLeftEventMessageDetail,
  ChatRenamedEventMessageDetail,
  ChannelRenamedEventMessageDetail,
  ChannelAddedEventMessageDetail,
  ChannelDeletedEventMessageDetail,
  ChannelDescriptionUpdatedEventMessageDetail,
  ChannelSetAsFavoriteByDefaultEventMessageDetail,
  ChannelUnsetAsFavoriteByDefaultEventMessageDetail,
  CallStartedEventMessageDetail,
  CallEndedEventMessageDetail,
  CallRecordingEventMessageDetail,
  CallTranscriptEventMessageDetail,
  MessagePinnedEventMessageDetail,
  MessageUnpinnedEventMessageDetail,
  TeamRenamedEventMessageDetail,
  TeamCreatedEventMessageDetail,
  TeamArchivedEventMessageDetail,
  TeamUnarchivedEventMessageDetail,
  TeamDescriptionUpdatedEventMessageDetail,
  TeamJoiningDisabledEventMessageDetail,
  TeamJoiningEnabledEventMessageDetail,
  TeamsAppInstalledEventMessageDetail,
  TeamsAppRemovedEventMessageDetail,
  TeamsAppUpgradedEventMessageDetail,
  MeetingPolicyUpdatedEventMessageDetail,
  ConversationMemberRoleUpdatedEventMessageDetail,
  TabUpdatedEventMessageDetail,
} from '@microsoft/microsoft-graph-types'

export type { MessageType } from '#shared/utils/enums'

export interface GraphRequestOptions {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH'
  path: string
  body?: unknown
  query?: Record<string, string>
  accessToken: string
}

export interface ODataError {
  error: {
    code: string
    message: string
  }
}

export type { TokenResponse } from './token-exchange'

export const TOKEN_ENDPOINT = 'https://login.microsoftonline.com'
