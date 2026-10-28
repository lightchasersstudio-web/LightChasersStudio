export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      add_ons: {
        Row: {
          created_at: string
          description: string | null
          extra_minutes: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          service_ids: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          extra_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          service_ids?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          extra_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          service_ids?: string[]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_profiles: {
        Row: {
          created_at: string
          full_name: string | null
          role: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
          metadata?: Json
        }
        Relationships: []
      }
      availability_rules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: []
      }
      blackout_dates: {
        Row: {
          created_at: string
          date: string
          id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      booking_add_ons: {
        Row: {
          add_on_id: string | null
          booking_id: string
          created_at: string
          id: string
          name: string
          price_cents: number
        }
        Insert: {
          add_on_id?: string | null
          booking_id: string
          created_at?: string
          id?: string
          name: string
          price_cents: number
        }
        Update: {
          add_on_id?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          name?: string
          price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_add_ons_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_add_ons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          admin_notes: string | null
          attendees: Json
          blocked_until: string
          client_id: string
          contact_name: string
          contact_phone: string
          created_at: string
          deposit_cents: number
          end_at: string
          has_end_time: boolean
          hold_expires_at: string | null
          id: string
          location: string | null
          messenger: string | null
          needs_refund_review: boolean
          participants: number
          preferred_contact: Database["public"]["Enums"]["contact_method"]
          price_cents: number
          reference_code: string
          service_id: string
          source: string
          special_requests: string | null
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          vat_cents: number
        }
        Insert: {
          admin_notes?: string | null
          attendees?: Json
          blocked_until: string
          client_id: string
          contact_name: string
          contact_phone: string
          created_at?: string
          deposit_cents: number
          end_at: string
          has_end_time?: boolean
          hold_expires_at?: string | null
          id?: string
          location?: string | null
          messenger?: string | null
          needs_refund_review?: boolean
          participants?: number
          preferred_contact: Database["public"]["Enums"]["contact_method"]
          price_cents: number
          reference_code: string
          service_id: string
          source?: string
          special_requests?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          vat_cents?: number
        }
        Update: {
          admin_notes?: string | null
          attendees?: Json
          blocked_until?: string
          client_id?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          deposit_cents?: number
          end_at?: string
          has_end_time?: boolean
          hold_expires_at?: string | null
          id?: string
          location?: string | null
          messenger?: string | null
          needs_refund_review?: boolean
          participants?: number
          preferred_contact?: Database["public"]["Enums"]["contact_method"]
          price_cents?: number
          reference_code?: string
          service_id?: string
          source?: string
          special_requests?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          vat_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          about: string | null
          address: string | null
          buffer_minutes: number
          business_name: string
          city: string
          currency: string
          default_deposit_percent: number
          email: string | null
          facebook_url: string | null
          hold_minutes: number
          id: boolean
          instagram_url: string | null
          logo_path: string | null
          max_advance_days: number
          max_concurrent_bookings: number
          min_notice_hours: number
          phone: string | null
          slot_interval_minutes: number
          tagline: string | null
          tiktok_url: string | null
          timezone: string
          updated_at: string
          vat_percent: number
        }
        Insert: {
          about?: string | null
          address?: string | null
          buffer_minutes?: number
          business_name?: string
          city?: string
          currency?: string
          default_deposit_percent?: number
          email?: string | null
          facebook_url?: string | null
          hold_minutes?: number
          id?: boolean
          instagram_url?: string | null
          logo_path?: string | null
          max_advance_days?: number
          max_concurrent_bookings?: number
          min_notice_hours?: number
          phone?: string | null
          slot_interval_minutes?: number
          tagline?: string | null
          tiktok_url?: string | null
          timezone?: string
          updated_at?: string
          vat_percent?: number
        }
        Update: {
          about?: string | null
          address?: string | null
          buffer_minutes?: number
          business_name?: string
          city?: string
          currency?: string
          default_deposit_percent?: number
          email?: string | null
          facebook_url?: string | null
          hold_minutes?: number
          id?: boolean
          instagram_url?: string | null
          logo_path?: string | null
          max_advance_days?: number
          max_concurrent_bookings?: number
          min_notice_hours?: number
          phone?: string | null
          slot_interval_minutes?: number
          tagline?: string | null
          tiktok_url?: string | null
          timezone?: string
          updated_at?: string
          vat_percent?: number
        }
        Relationships: []
      }
      clients: {
        Row: {
          consent_given_at: string
          consent_version: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string
          preferred_contact: Database["public"]["Enums"]["contact_method"]
          updated_at: string
        }
        Insert: {
          consent_given_at: string
          consent_version: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone: string
          preferred_contact?: Database["public"]["Enums"]["contact_method"]
          updated_at?: string
        }
        Update: {
          consent_given_at?: string
          consent_version?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
          preferred_contact?: Database["public"]["Enums"]["contact_method"]
          updated_at?: string
        }
        Relationships: []
      }
      payment_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          payload: Json
          processed_at: string | null
          received_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          payload: Json
          processed_at?: string | null
          received_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          provider: string
          provider_checkout_id: string | null
          provider_payment_id: string | null
          raw: Json | null
          recorded_by: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          raw?: Json | null
          recorded_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          raw?: Json | null
          recorded_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_images: {
        Row: {
          alt_text: string
          blur_data_url: string | null
          caption: string | null
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          height: number | null
          id: string
          is_featured: boolean
          service_id: string | null
          sort_order: number
          storage_path: string
          width: number | null
        }
        Insert: {
          alt_text: string
          blur_data_url?: string | null
          caption?: string | null
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string
          height?: number | null
          id?: string
          is_featured?: boolean
          service_id?: string | null
          sort_order?: number
          storage_path: string
          width?: number | null
        }
        Update: {
          alt_text?: string
          blur_data_url?: string | null
          caption?: string | null
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          height?: number | null
          id?: string
          is_featured?: boolean
          service_id?: string | null
          sort_order?: number
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_images_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          id: string
          is_published: boolean
          name: string
          quote: string
          rating: number | null
          shoot: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string
          id?: string
          is_published?: boolean
          name: string
          quote: string
          rating?: number | null
          shoot: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          id?: string
          is_published?: boolean
          name?: string
          quote?: string
          rating?: number | null
          shoot?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          cover_image_path: string | null
          created_at: string
          deposit_cents: number | null
          description: string | null
          duration_minutes: number | null
          id: string
          inclusions: Json
          is_active: boolean
          name: string
          price_cents: number
          slug: string
          sort_order: number
          summary: string | null
          updated_at: string
          workshop_ends_at: string | null
          workshop_location: string | null
          workshop_seats: number | null
          workshop_starts_at: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["service_category"]
          cover_image_path?: string | null
          created_at?: string
          deposit_cents?: number | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          inclusions?: Json
          is_active?: boolean
          name: string
          price_cents: number
          slug: string
          sort_order?: number
          summary?: string | null
          updated_at?: string
          workshop_ends_at?: string | null
          workshop_location?: string | null
          workshop_seats?: number | null
          workshop_starts_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          cover_image_path?: string | null
          created_at?: string
          deposit_cents?: number | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          inclusions?: Json
          is_active?: boolean
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          summary?: string | null
          updated_at?: string
          workshop_ends_at?: string | null
          workshop_location?: string | null
          workshop_seats?: number | null
          workshop_starts_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_booking: {
        Args: {
          p_add_ons?: Json
          p_admin_id: string
          p_allow_outside_hours: boolean
          p_email: string
          p_full_name: string
          p_location: string
          p_messenger: string
          p_participants: number
          p_payment_amount_cents: number
          p_payment_provider: string
          p_payment_reference: string
          p_phone: string
          p_preferred_contact: Database["public"]["Enums"]["contact_method"]
          p_price_cents: number
          p_service_id: string
          p_special_requests: string
          p_start_at: string
        }
        Returns: {
          booking_id: string
          reference_code: string
        }[]
      }
      admin_update_booking: {
        Args: {
          p_add_ons: Json
          p_allow_outside_hours: boolean
          p_booking_id: string
          p_charge_vat: boolean
          p_contact_name: string
          p_contact_phone: string
          p_location: string
          p_messenger: string
          p_package_cents: number
          p_participants: number
          p_preferred_contact: Database["public"]["Enums"]["contact_method"]
          p_service_id: string
          p_special_requests: string
          p_start_at: string
        }
        Returns: {
          booking_id: string
          reference_code: string
        }[]
      }
      apply_booking_pricing: {
        Args: {
          p_add_ons: Json
          p_booking_id: string
          p_charge_vat: boolean
          p_package_cents: number
        }
        Returns: undefined
      }
      assert_capacity: {
        Args: { p_blocked_until: string; p_exclude?: string; p_start: string }
        Returns: undefined
      }
      booking_length_minutes: {
        Args: {
          p_duration_minutes: number
          p_extra_minutes: number
          p_slot_interval_minutes: number
        }
        Returns: number
      }
      create_booking: {
        Args: {
          p_add_on_ids?: string[]
          p_consent_version: string
          p_email: string
          p_full_name: string
          p_location?: string
          p_messenger?: string
          p_participants?: number
          p_attendees?: string[]
          p_pay_in_full?: boolean
          p_phone: string
          p_preferred_contact: Database["public"]["Enums"]["contact_method"]
          p_service_id: string
          p_special_requests?: string
          p_start_at: string
        }
        Returns: {
          booking_id: string
          deposit_cents: number
          hold_expires_at: string
          reference_code: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      booking_holds_place: {
        Args: {
          p_hold_expires_at: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: boolean
      }
      delete_booking: {
        Args: { p_booking_id: string }
        Returns: {
          contact_name: string
          reference_code: string
        }[]
      }
      expire_stale_holds: { Args: never; Returns: number }
      get_busy_ranges: {
        Args: { p_from: string; p_to: string }
        Returns: {
          blocked_until: string
          start_at: string
        }[]
      }
      hit_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      mark_booking_paid: {
        Args: {
          p_amount_cents: number
          p_checkout_id: string
          p_payment_id: string
          p_raw: Json
          p_reference: string
        }
        Returns: {
          booking_id: string
          outcome: string
        }[]
      }
      replace_availability_rules: {
        Args: { p_rules: Json }
        Returns: undefined
      }
      staff_add_on_minutes: { Args: { p_add_ons: Json }; Returns: number }
      workshop_seats_taken: { Args: { p_service_id: string }; Returns: number }
    }
    Enums: {
      admin_role: "owner" | "admin"
      booking_status:
        | "pending_payment"
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "declined"
        | "expired"
      contact_method: "email" | "phone" | "sms" | "messenger" | "viber"
      payment_status: "pending" | "paid" | "failed" | "expired" | "refunded"
      service_category:
        | "wedding"
        | "portrait"
        | "studio"
        | "event"
        | "commercial"
        | "workshop"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role: ["owner", "admin"],
      booking_status: [
        "pending_payment",
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "declined",
        "expired",
      ],
      contact_method: ["email", "phone", "sms", "messenger", "viber"],
      payment_status: ["pending", "paid", "failed", "expired", "refunded"],
      service_category: [
        "wedding",
        "portrait",
        "studio",
        "event",
        "commercial",
        "workshop",
      ],
    },
  },
} as const
