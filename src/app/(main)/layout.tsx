'use client'

import { useEffect } from 'react'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { FloatingInventoryPanel } from '@/components/inventory/floating-inventory-panel'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/use-auth-store'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const setProfile = useAuthStore((state) => state.setProfile)

  useEffect(() => {
    const supabase = createClient()

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(profile)
      }
    }

    loadProfile()
  }, [setProfile])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {children}
      </SidebarInset>
      <FloatingInventoryPanel />
    </SidebarProvider>
  )
}
