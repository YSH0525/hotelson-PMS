'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CalendarRange,
  BedDouble,
  ClipboardList,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  FormInput,
  Package,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/use-auth-store'
import { usePanelStore } from '@/stores/use-panel-store'
import { useQuery } from '@tanstack/react-query'
import type { HotelSettings } from '@/types/database'

const mainMenuItems = [
  { title: '타임라인', url: '/timeline', icon: CalendarRange },
  { title: '예약 목록', url: '/reservations', icon: ClipboardList },
  { title: '당일판매일지', url: '/daily-report', icon: FileText },
  { title: '보고서', url: '/reports', icon: BarChart3 },
]

const settingsMenuItems = [
  { title: '객실 관리', url: '/rooms', icon: BedDouble },
  { title: '일반 설정', url: '/settings', icon: Settings },
  { title: '예약폼 빌더', url: '/settings/form-builder', icon: FormInput },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const profile = useAuthStore((state) => state.profile)
  const toggleInventory = usePanelStore((s) => s.toggle)
  const inventoryOpen = usePanelStore((s) => s.isOpen)
  const supabase = createClient()

  const { data: settings } = useQuery({
    queryKey: ['hotelSettings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotel_settings')
        .select('*')
        .single()
      if (error) throw error
      return data as HotelSettings
    },
  })

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/timeline" className="flex items-center gap-2">
          <Logo variant="compact" className="h-9 shrink-0" />
          {settings?.hotel_name && (
            <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400 truncate">
              {settings.hotel_name}
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메인 메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton isActive={inventoryOpen} onClick={toggleInventory}>
                  <Package className="h-4 w-4" />
                  <span>객실 재고</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>설정</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url || pathname.startsWith(item.url + '/')}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <p className="font-medium">{profile?.name ?? '사용자'}</p>
            <p className="text-muted-foreground text-xs">
              {profile?.role === 'admin' ? '관리자' : profile?.role === 'manager' ? '매니저' : '직원'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="로그아웃">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
