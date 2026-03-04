'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, BedDouble } from 'lucide-react'
import { toast } from 'sonner'
import { useRoomTypes, useCreateRoomType, useUpdateRoomType, useDeleteRoomType } from '@/hooks/use-room-types'
import { useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom, useReorderRooms } from '@/hooks/use-rooms'
import { RoomTypeForm } from '@/components/rooms/room-type-form'
import { RoomForm } from '@/components/rooms/room-form'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ROOM_STATUS } from '@/lib/constants'
import type { RoomType, Room } from '@/types/database'

export default function RoomsPage() {
  const { data: roomTypes = [], isLoading: loadingTypes } = useRoomTypes()
  const { data: rooms = [] } = useRooms()
  const createRoomType = useCreateRoomType()
  const updateRoomType = useUpdateRoomType()
  const deleteRoomType = useDeleteRoomType()
  const createRoom = useCreateRoom()
  const updateRoom = useUpdateRoom()
  const deleteRoom = useDeleteRoom()
  const reorderRooms = useReorderRooms()

  // 객실타입 폼 상태
  const [typeFormOpen, setTypeFormOpen] = useState(false)
  const [editingType, setEditingType] = useState<RoomType | null>(null)

  // 호실 폼 상태
  const [roomFormOpen, setRoomFormOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)

  // 삭제 확인 상태
  const [deleteTypeId, setDeleteTypeId] = useState<string | null>(null)
  const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null)

  const handleCreateType = async (data: { name: string; color: string; default_price: number }) => {
    try {
      await createRoomType.mutateAsync({
        ...data,
        sort_order: roomTypes.length,
      })
      toast.success('객실타입이 추가되었습니다.')
      setTypeFormOpen(false)
    } catch {
      toast.error('객실타입 추가에 실패했습니다.')
    }
  }

  const handleUpdateType = async (data: { name: string; color: string; default_price: number }) => {
    if (!editingType) return
    try {
      await updateRoomType.mutateAsync({ id: editingType.id, ...data })
      toast.success('객실타입이 수정되었습니다.')
      setEditingType(null)
    } catch {
      toast.error('객실타입 수정에 실패했습니다.')
    }
  }

  const handleDeleteType = async () => {
    if (!deleteTypeId) return
    try {
      await deleteRoomType.mutateAsync(deleteTypeId)
      toast.success('객실타입이 삭제되었습니다.')
      setDeleteTypeId(null)
    } catch {
      toast.error('객실타입 삭제에 실패했습니다. 해당 타입의 호실을 먼저 삭제해주세요.')
    }
  }

  const handleCreateRoom = async (data: { room_number: string; floor: number; status: Room['status'] }) => {
    if (!selectedTypeId) return
    try {
      const newRoom = await createRoom.mutateAsync({
        ...data,
        room_type_id: selectedTypeId,
        sort_order: 9999, // 임시값, 아래에서 재정렬
      })

      // 해당 타입 전체 객실을 room_number 기준으로 자동 재정렬
      const allTypeRooms = [...rooms.filter((r) => r.room_type_id === selectedTypeId), newRoom]
      allTypeRooms.sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }))
      await reorderRooms.mutateAsync(allTypeRooms.map((r) => r.id))

      toast.success('호실이 추가되었습니다.')
      setRoomFormOpen(false)
      setSelectedTypeId(null)
    } catch {
      toast.error('호실 추가에 실패했습니다. 호실 번호가 중복되지 않는지 확인하세요.')
    }
  }

  const handleUpdateRoom = async (data: { room_number: string; floor: number; status: Room['status'] }) => {
    if (!editingRoom) return
    try {
      await updateRoom.mutateAsync({ id: editingRoom.id, ...data })
      toast.success('호실이 수정되었습니다.')
      setEditingRoom(null)
    } catch {
      toast.error('호실 수정에 실패했습니다.')
    }
  }

  const handleDeleteRoom = async () => {
    if (!deleteRoomId) return
    try {
      await deleteRoom.mutateAsync(deleteRoomId)
      toast.success('호실이 삭제되었습니다.')
      setDeleteRoomId(null)
    } catch {
      toast.error('호실 삭제에 실패했습니다. 해당 호실에 예약이 있는지 확인하세요.')
    }
  }

  return (
    <>
      <Header title="객실 관리" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">객실타입 및 호실</h2>
            <p className="text-sm text-muted-foreground">
              객실타입을 만들고 각 타입에 호실을 등록하세요.
            </p>
          </div>
          <Button onClick={() => setTypeFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            객실타입 추가
          </Button>
        </div>

        {loadingTypes ? (
          <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
        ) : roomTypes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BedDouble className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">등록된 객실타입이 없습니다</p>
              <p className="text-sm text-muted-foreground mb-4">
                객실타입을 추가하여 시작하세요.
              </p>
              <Button onClick={() => setTypeFormOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                객실타입 추가
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {roomTypes.map((rt) => {
              const typeRooms = rooms.filter((r) => r.room_type_id === rt.id)

              return (
                <Card key={rt.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: rt.color }}
                        />
                        <CardTitle className="text-base">{rt.name}</CardTitle>
                        <Badge variant="secondary">{typeRooms.length}실</Badge>
                        <span className="text-sm text-muted-foreground">
                          기본가 {rt.default_price.toLocaleString()}원
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingType(rt)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTypeId(rt.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTypeId(rt.id)
                            setRoomFormOpen(true)
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          호실 추가
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {typeRooms.length > 0 && (
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {typeRooms.map((room) => {
                          const statusInfo = ROOM_STATUS[room.status]
                          return (
                            <div
                              key={room.id}
                              className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{room.room_number}호</span>
                                <span className="text-xs text-muted-foreground">{room.floor}층</span>
                                {room.status !== 'available' && (
                                  <Badge variant="outline" className="text-[10px] px-1">
                                    {statusInfo.label}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setEditingRoom(room)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setDeleteRoomId(room.id)}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* 객실타입 추가 폼 */}
      <RoomTypeForm
        open={typeFormOpen}
        onOpenChange={setTypeFormOpen}
        onSubmit={handleCreateType}
        loading={createRoomType.isPending}
      />

      {/* 객실타입 수정 폼 */}
      {editingType && (
        <RoomTypeForm
          open={!!editingType}
          onOpenChange={(open) => !open && setEditingType(null)}
          onSubmit={handleUpdateType}
          defaultValues={editingType}
          loading={updateRoomType.isPending}
        />
      )}

      {/* 호실 추가 폼 */}
      <RoomForm
        open={roomFormOpen}
        onOpenChange={(open) => {
          setRoomFormOpen(open)
          if (!open) setSelectedTypeId(null)
        }}
        onSubmit={handleCreateRoom}
        loading={createRoom.isPending}
      />

      {/* 호실 수정 폼 */}
      {editingRoom && (
        <RoomForm
          open={!!editingRoom}
          onOpenChange={(open) => !open && setEditingRoom(null)}
          onSubmit={handleUpdateRoom}
          defaultValues={editingRoom}
          loading={updateRoom.isPending}
        />
      )}

      {/* 객실타입 삭제 확인 */}
      <ConfirmDialog
        open={!!deleteTypeId}
        onOpenChange={(open) => !open && setDeleteTypeId(null)}
        title="객실타입 삭제"
        description="이 객실타입과 포함된 모든 호실이 삭제됩니다. 계속하시겠습니까?"
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={handleDeleteType}
        loading={deleteRoomType.isPending}
      />

      {/* 호실 삭제 확인 */}
      <ConfirmDialog
        open={!!deleteRoomId}
        onOpenChange={(open) => !open && setDeleteRoomId(null)}
        title="호실 삭제"
        description="이 호실을 삭제하시겠습니까? 해당 호실의 예약 데이터도 영향을 받을 수 있습니다."
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={handleDeleteRoom}
        loading={deleteRoom.isPending}
      />
    </>
  )
}
