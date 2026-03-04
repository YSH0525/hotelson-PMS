'use client'

import { useState } from 'react'
import { BedDouble, Clock, Coins } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/use-ui-store'
import { useTimelineStore } from '@/stores/use-timeline-store'

interface TimelineCellPopoverProps {
  roomId: string
  date: string
  children: React.ReactNode
}

export function TimelineCellPopover({
  roomId,
  date,
  children,
}: TimelineCellPopoverProps) {
  const [open, setOpen] = useState(false)

  const openReservationDialog = useUIStore((s) => s.openReservationDialog)
  const openHourlyDialog = useUIStore((s) => s.openHourlyDialog)
  const openOtherRevenueDialog = useUIStore((s) => s.openOtherRevenueDialog)
  const setSelectedCell = useTimelineStore((s) => s.setSelectedCell)

  const handleSelect = (type: 'stay' | 'hourly' | 'other_revenue') => {
    setSelectedCell(roomId, date)
    switch (type) {
      case 'stay':
        openReservationDialog()
        break
      case 'hourly':
        openHourlyDialog()
        break
      case 'other_revenue':
        openOtherRevenueDialog()
        break
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start" sideOffset={4}>
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => handleSelect('stay')}
          >
            <BedDouble className="size-4" />
            <span>숙박</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => handleSelect('hourly')}
          >
            <Clock className="size-4" />
            <span>대실</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => handleSelect('other_revenue')}
          >
            <Coins className="size-4" />
            <span>기타매출</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
