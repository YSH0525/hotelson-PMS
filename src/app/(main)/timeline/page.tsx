'use client'

import { Header } from '@/components/layout/header'
import { TimelineContainer } from '@/components/timeline/timeline-container'
import { ReservationDialog } from '@/components/reservations/reservation-dialog'
import { HourlyDialog } from '@/components/reservations/hourly-dialog'
import { OtherRevenueDialog } from '@/components/reservations/other-revenue-dialog'

export default function TimelinePage() {
  return (
    <>
      <Header title="타임라인" />
      <div className="flex-1 overflow-hidden">
        <TimelineContainer />
      </div>
      <ReservationDialog />
      <HourlyDialog />
      <OtherRevenueDialog />
    </>
  )
}
