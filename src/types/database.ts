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
