export const hasSameIds = (expectedIds, receivedIds) => {
  const expected = expectedIds.map((id) => id.toString())
  const received = receivedIds.map((id) => id.toString())
  const receivedSet = new Set(received)

  return (
    expected.length === received.length &&
    receivedSet.size === received.length &&
    expected.every((id) => receivedSet.has(id))
  )
}
