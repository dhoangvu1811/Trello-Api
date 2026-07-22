export const ENSURE_DATABASE_INDEXES = async (database) => {
  await Promise.all([
    database.collection('users').createIndexes([
      { key: { email: 1 }, name: 'users_email_unique', unique: true },
      {
        key: { passwordResetTokenHash: 1 },
        name: 'users_password_reset_token_unique',
        unique: true,
        partialFilterExpression: {
          passwordResetTokenHash: { $type: 'string' }
        }
      }
    ]),
    database.collection('boards').createIndexes([
      { key: { ownerIds: 1, _destroy: 1 }, name: 'boards_owner_active' },
      { key: { memberIds: 1, _destroy: 1 }, name: 'boards_member_active' }
    ]),
    database.collection('cards').createIndexes([
      { key: { boardId: 1, columnId: 1 }, name: 'cards_board_column' },
      { key: { memberIds: 1, dueDate: 1 }, name: 'cards_member_due_date' },
      {
        key: { boardId: 1, archivedAt: -1 },
        name: 'cards_board_archived_at'
      }
    ]),
    database.collection('columns').createIndex(
      { boardId: 1, _destroy: 1 },
      { name: 'columns_board_active' }
    ),
    database.collection('activities').createIndexes([
      {
        key: { boardId: 1, createdAt: -1 },
        name: 'activities_board_created_at'
      },
      {
        key: { entityId: 1, createdAt: -1 },
        name: 'activities_entity_created_at'
      }
    ]),
    database.collection('invitations').createIndexes([
      {
        key: { inviteeId: 1, createdAt: -1 },
        name: 'invitations_invitee_created_at'
      },
      {
        key: {
          'boardInvitation.boardId': 1,
          inviteeId: 1,
          'boardInvitation.status': 1
        },
        name: 'invitations_board_invitee_status'
      }
    ]),
    database.collection('rateLimits').createIndex(
      { expiresAt: 1 },
      { name: 'rate_limits_expiry', expireAfterSeconds: 0 }
    ),
    database.collection('authSessions').createIndexes([
      {
        key: { expiresAt: 1 },
        name: 'auth_sessions_expiry',
        expireAfterSeconds: 0
      },
      { key: { userId: 1, revokedAt: 1 }, name: 'auth_sessions_user_active' }
    ])
  ])
}
