'use client'

import type { RoomType, Room } from '@/types/database'
import { TIMELINE_ROOM_LIST_WIDTH, TIMELINE_CELL_HEIGHT } from '@/lib/constants'

interface TimelineRoomListProps {
  roomTypes: RoomType[]
  roomsByType: Map<string, Room[]>
}

export function TimelineRoomList({ roomTypes, roomsByType }: TimelineRoomListProps) {
  return (
    <div className="sticky left-0 z-20 bg-background border-r" style={{ width: TIMELINE_ROOM_LIST_WIDTH }}>
      {roomTypes.map((rt) => {
        const rooms = roomsByType.get(rt.id) || []
        if (rooms.length === 0) return null

        return (
          <div key={rt.id}>
            <div
              className="flex items-center px-3 bg-muted border-b text-sm font-semibold"
              style={{ height: TIMELINE_CELL_HEIGHT }}
            >
              <div
                className="w-3 h-3 rounded-full mr-2 shrink-0"
                style={{ backgroundColor: rt.color }}
              />
              {rt.name}
              <span className="text-muted-foreground text-xs ml-1">({rooms.length})</span>
            </div>
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center px-3 border-b text-sm"
                style={{ height: TIMELINE_CELL_HEIGHT }}
              >
                <span className="text-muted-foreground mr-2">└</span>
                {room.room_number}호
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
