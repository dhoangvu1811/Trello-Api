export const inviteUserToBoardSocket = (socket) => {
  // lắng nghe sự kiện mà client emit lên FE_USER_INVITED_TO_BOARD
  socket.on('FE_USER_INVITED_TO_BOARD', (invitation) => {
    // Cách làm nhanh & đơn giản nhất: Emit ngược lại một sự kiện về cho mọi client khác (ngoại trừ thằng gửi request)
    socket.broadcast.emit('BE_USER_INVITED_TO_BOARD', invitation)
  })
}
