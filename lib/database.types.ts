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
      meals: {
        Row: {
          id: string
          user_id: string
          eaten_at: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          eaten_at: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          eaten_at?: string
          notes?: string | null
          created_at?: string
        }
      }
      meal_items: {
        Row: {
          id: string
          meal_id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          meal_id: string
          user_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          meal_id?: string
          user_id?: string
          name?: string
          created_at?: string
        }
      }
      itch_events: {
        Row: {
          id: string
          user_id: string
          started_at: string
          severity: number | null
          body_areas: string[]
          has_bumps: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          started_at: string
          severity?: number | null
          body_areas?: string[]
          has_bumps?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          started_at?: string
          severity?: number | null
          body_areas?: string[]
          has_bumps?: boolean
          notes?: string | null
          created_at?: string
        }
      }
      medications: {
        Row: {
          id: string
          user_id: string
          name: string
          kind: 'oral' | 'topical'
          interval_hours: number
          reminder_hour: number | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          kind: 'oral' | 'topical'
          interval_hours?: number
          reminder_hour?: number | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          kind?: 'oral' | 'topical'
          interval_hours?: number
          reminder_hour?: number | null
          active?: boolean
          created_at?: string
        }
      }
      medication_logs: {
        Row: {
          id: string
          user_id: string
          medication_id: string
          taken_at: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          medication_id: string
          taken_at: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          medication_id?: string
          taken_at?: string
          notes?: string | null
          created_at?: string
        }
      }
      daily_context: {
        Row: {
          id: string
          user_id: string
          date: string
          stress: number | null
          sleep_hours: number | null
          weather_notes: string | null
          new_products: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          stress?: number | null
          sleep_hours?: number | null
          weather_notes?: string | null
          new_products?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          stress?: number | null
          sleep_hours?: number | null
          weather_notes?: string | null
          new_products?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      analysis_cache: {
        Row: {
          id: string
          user_id: string
          cache_key: string
          data: Json
          computed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          cache_key: string
          data: Json
          computed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          cache_key?: string
          data?: Json
          computed_at?: string
        }
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
  }
}

// Convenience types
export type Meal = Database['public']['Tables']['meals']['Row']
export type MealInsert = Database['public']['Tables']['meals']['Insert']
export type MealItem = Database['public']['Tables']['meal_items']['Row']
export type MealItemInsert = Database['public']['Tables']['meal_items']['Insert']
export type ItchEvent = Database['public']['Tables']['itch_events']['Row']
export type ItchEventInsert = Database['public']['Tables']['itch_events']['Insert']
export type Medication = Database['public']['Tables']['medications']['Row']
export type MedicationInsert = Database['public']['Tables']['medications']['Insert']
export type MedicationLog = Database['public']['Tables']['medication_logs']['Row']
export type MedicationLogInsert = Database['public']['Tables']['medication_logs']['Insert']
export type DailyContext = Database['public']['Tables']['daily_context']['Row']
export type DailyContextInsert = Database['public']['Tables']['daily_context']['Insert']

export type MealWithItems = Meal & { meal_items: MealItem[] }

export type TimelineEntry =
  | { type: 'meal'; data: MealWithItems }
  | { type: 'itch'; data: ItchEvent }
  | { type: 'medication'; data: MedicationLog & { medication: Medication } }
