import { activityModel } from '~/models/activityModel'

const createNew = async (activityData, session) =>
  await activityModel.createNew(activityData, session)

export const activityService = { createNew }
