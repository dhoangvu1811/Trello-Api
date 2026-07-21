import { activityModel } from '~/models/activityModel'

const createNew = async (activityData, session) =>
  await activityModel.createNew(activityData, session)

const getByBoardId = async (boardId, page, itemsPerPage) =>
  await activityModel.findByBoardId(boardId, page, itemsPerPage)

export const activityService = { createNew, getByBoardId }
