const sortExpression = { timestamp: 1, aggregateVersion: 1 }
const projectionExpression = { _id: 0 }

const loadEvents = async (
  { collection },
  {
    eventTypes,
    aggregateIds,
    startTime,
    finishTime,
    maxEvents = Number.POSITIVE_INFINITY,
    closedInterval = false
  },
  callback
) => {
  const ltOp = closedInterval ? '$lte' : '$lt'
  const gtOp = closedInterval ? '$gte' : '$gt'

  const findExpression = {
    ...(eventTypes != null ? { type: { $in: eventTypes } } : {}),
    ...(aggregateIds != null ? { aggregateId: { $in: aggregateIds } } : {}),
    timestamp: {
      [gtOp]: startTime != null ? startTime : 0,
      [ltOp]: finishTime != null ? finishTime : Infinity
    }
  }

  const cursorStream = collection
    .find(findExpression)
    .sort(sortExpression)
    .project(projectionExpression)
    .stream()

  let lastError = null

  let initialTimestamp = null
  let countEvents = 0
  for (
    let event = await cursorStream.next();
    event != null;
    event = await cursorStream.next()
  ) {
    try {
      await callback(event)

      if (initialTimestamp == null) {
        initialTimestamp = event.timestamp
      }

      if (countEvents++ > maxEvents && event.timestamp !== initialTimestamp) {
        break
      }
    } catch (error) {
      lastError = error
      break
    }
  }

  await cursorStream.close()

  if (lastError != null) {
    throw lastError
  }
}

export default loadEvents
