export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      hotel_settings: {
        Row: {
          id: string
          hotel_name: string
          address: string
          phone: string
          email: string
          check_in_time: string
          check_out_time: string
          tax_rate: number
          currency: string
          timezone: string
          notification_settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          hotel_name: string
          address?: string
          phone?: string
          email?: string
          check_in_time?: string
          check_out_time?: string
          tax_rate?: number
          currency?: string
          timezone?: string
          notification_settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          hotel_name?: string
          address?: string
          phone?: string
          email?: string
          check_in_time?: string
          check_out_time?: string
          tax_rate?: number
          currency?: string
          timezone?: string
          notification_settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          name: string
          role: 'admin' | 'manager' | 'staff'
          created_at: string
        }
        Insert: {
          id: string
          name: string
          role?: 'admin' | 'manager' | 'staff'
          created_at?: string
        }
        Update: {
          name?: string
          role?: 'admin' | 'manager' | 'staff'
        }
        Relationships: []
      }
      room_types: {
        Row: {
          id: string
          name: string
          sort_order: number
          color: string
          default_price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          color?: string
          default_price?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          sort_order?: number
          color?: string
          default_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          id: string
          room_type_id: string
          room_number: string
          floor: number
          status: 'available' | 'maintenance' | 'out_of_order'
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_type_id: string
          room_number: string
          floor?: number
          status?: 'available' | 'maintenance' | 'out_of_order'
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          room_type_id?: string
          room_number?: string
          floor?: number
          status?: 'available' | 'maintenance' | 'out_of_order'
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rooms_room_type_id_fkey'
            columns: ['room_type_id']
            isOneToOne: false
            referencedRelation: 'room_types'
            referencedColumns: ['id']
          }
        ]
      }
      reservations: {
        Row: {
          id: string
          entry_type: 'stay' | 'hourly' | 'other_revenue'
          room_id: string
          room_type_id: string
          check_in_date: string
          check_out_date: string
          check_in_time: string | null
          check_out_time: string | null
          nights: number
          guest_name: string
          guest_phone: string | null
          guest_email: string | null
          status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
          total_amount: number
          memo: string | null
          custom_fields: Json
          revenue_category: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          entry_type?: 'stay' | 'hourly' | 'other_revenue'
          room_id: string
          room_type_id: string
          check_in_date: string
          check_out_date: string
          check_in_time?: string | null
          check_out_time?: string | null
          guest_name: string
          guest_phone?: string | null
          guest_email?: string | null
          status?: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
          total_amount?: number
          memo?: string | null
          custom_fields?: Json
          revenue_category?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          entry_type?: 'stay' | 'hourly' | 'other_revenue'
          room_id?: string
          room_type_id?: string
          check_in_date?: string
          check_out_date?: string
          check_in_time?: string | null
          check_out_time?: string | null
          guest_name?: string
          guest_phone?: string | null
          guest_email?: string | null
          status?: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
          total_amount?: number
          memo?: string | null
          custom_fields?: Json
          revenue_category?: string | null
          created_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reservations_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reservations_room_type_id_fkey'
            columns: ['room_type_id']
            isOneToOne: false
            referencedRelation: 'room_types'
            referencedColumns: ['id']
          }
        ]
      }
      payments: {
        Row: {
          id: string
          reservation_id: string
          amount: number
          method: string
          channel: string | null
          paid_at: string
          memo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          amount: number
          method: string
          channel?: string | null
          paid_at?: string
          memo?: string | null
          created_at?: string
        }
        Update: {
          amount?: number
          method?: string
          channel?: string | null
          paid_at?: string
          memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'payments_reservation_id_fkey'
            columns: ['reservation_id']
            isOneToOne: false
            referencedRelation: 'reservations'
            referencedColumns: ['id']
          }
        ]
      }
      cash_ledger: {
        Row: {
          id: string
          entry_date: string
          entry_type: 'opening' | 'income' | 'expense' | 'closing'
          category: string
          description: string | null
          amount: number
          reservation_id: string | null
          memo: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          entry_date: string
          entry_type: 'opening' | 'income' | 'expense' | 'closing'
          category: string
          description?: string | null
          amount: number
          reservation_id?: string | null
          memo?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          entry_date?: string
          entry_type?: 'opening' | 'income' | 'expense' | 'closing'
          category?: string
          description?: string | null
          amount?: number
          reservation_id?: string | null
          memo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cash_ledger_reservation_id_fkey'
            columns: ['reservation_id']
            isOneToOne: false
            referencedRelation: 'reservations'
            referencedColumns: ['id']
          }
        ]
      }
      form_schemas: {
        Row: {
          id: string
          name: string
          is_default: boolean
          fields: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          is_default?: boolean
          fields?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          is_default?: boolean
          fields?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ota_connections: {
        Row: {
          id: string
          channel: string
          is_enabled: boolean
          partner_url: string | null
          property_id: string | null
          last_sync_at: string | null
          sync_status: 'idle' | 'syncing' | 'success' | 'error'
          error_message: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          channel: string
          is_enabled?: boolean
          partner_url?: string | null
          property_id?: string | null
          last_sync_at?: string | null
          sync_status?: 'idle' | 'syncing' | 'success' | 'error'
          error_message?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          is_enabled?: boolean
          partner_url?: string | null
          property_id?: string | null
          last_sync_at?: string | null
          sync_status?: 'idle' | 'syncing' | 'success' | 'error'
          error_message?: string | null
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ota_sync_logs: {
        Row: {
          id: string
          connection_id: string
          channel: string
          sync_date: string
          status: 'started' | 'success' | 'error'
          reservations_found: number
          reservations_created: number
          reservations_updated: number
          reservations_skipped: number
          error_message: string | null
          raw_data: Json
          created_at: string
        }
        Insert: {
          id?: string
          connection_id: string
          channel: string
          sync_date: string
          status: 'started' | 'success' | 'error'
          reservations_found?: number
          reservations_created?: number
          reservations_updated?: number
          reservations_skipped?: number
          error_message?: string | null
          raw_data?: Json
          created_at?: string
        }
        Update: {
          status?: 'started' | 'success' | 'error'
          reservations_found?: number
          reservations_created?: number
          reservations_updated?: number
          reservations_skipped?: number
          error_message?: string | null
          raw_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'ota_sync_logs_connection_id_fkey'
            columns: ['connection_id']
            isOneToOne: false
            referencedRelation: 'ota_connections'
            referencedColumns: ['id']
          }
        ]
      }
      ota_reservation_map: {
        Row: {
          id: string
          reservation_id: string
          channel: string
          ota_reservation_id: string
          ota_status: string | null
          ota_amount: number
          ota_deposit_amount: number
          raw_data: Json
          synced_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          channel: string
          ota_reservation_id: string
          ota_status?: string | null
          ota_amount?: number
          ota_deposit_amount?: number
          raw_data?: Json
          synced_at?: string
        }
        Update: {
          ota_status?: string | null
          ota_amount?: number
          ota_deposit_amount?: number
          raw_data?: Json
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ota_reservation_map_reservation_id_fkey'
            columns: ['reservation_id']
            isOneToOne: false
            referencedRelation: 'reservations'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// 편의 타입
export type RoomType = Database['public']['Tables']['room_types']['Row']
export type RoomTypeInsert = Database['public']['Tables']['room_types']['Insert']
export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomInsert = Database['public']['Tables']['rooms']['Insert']
export type Reservation = Database['public']['Tables']['reservations']['Row']
export type ReservationInsert = Database['public']['Tables']['reservations']['Insert']
export type ReservationUpdate = Database['public']['Tables']['reservations']['Update']
export type Payment = Database['public']['Tables']['payments']['Row']
export type PaymentInsert = Database['public']['Tables']['payments']['Insert']
export type FormSchema = Database['public']['Tables']['form_schemas']['Row']
export type FormSchemaInsert = Database['public']['Tables']['form_schemas']['Insert']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type HotelSettings = Database['public']['Tables']['hotel_settings']['Row']
export type CashLedger = Database['public']['Tables']['cash_ledger']['Row']
export type CashLedgerInsert = Database['public']['Tables']['cash_ledger']['Insert']
export type OtaConnection = Database['public']['Tables']['ota_connections']['Row']
export type OtaConnectionInsert = Database['public']['Tables']['ota_connections']['Insert']
export type OtaConnectionUpdate = Database['public']['Tables']['ota_connections']['Update']
export type OtaSyncLog = Database['public']['Tables']['ota_sync_logs']['Row']
export type OtaSyncLogInsert = Database['public']['Tables']['ota_sync_logs']['Insert']
export type OtaReservationMap = Database['public']['Tables']['ota_reservation_map']['Row']
export type OtaReservationMapInsert = Database['public']['Tables']['ota_reservation_map']['Insert']
