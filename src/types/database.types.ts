
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"role": Database["public"]['Enums']["admin_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"role"?: Database["public"]['Enums']["admin_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"role"?: Database["public"]['Enums']["admin_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity": string,"entity_id": string | null,"id": number,"metadata": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: never,"metadata"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: never,"metadata"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"availability_rules": {
                  Row: {
                    "created_at": string,"day_of_week": number,"end_time": string,"id": string,"start_time": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day_of_week": number,"end_time": string,"id"?: string,"start_time": string
                  }
                  Update: {
                    "created_at"?: string,"day_of_week"?: number,"end_time"?: string,"id"?: string,"start_time"?: string
                  }
                  Relationships: [
                    
                  ]
                },"blackout_dates": {
                  Row: {
                    "created_at": string,"date": string,"id": string,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"id"?: string,"reason"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"id"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"bookings": {
                  Row: {
                    "admin_notes": string | null,"blocked_until": string,"client_id": string,"contact_name": string,"contact_phone": string,"created_at": string,"deposit_cents": number,"end_at": string,"hold_expires_at": string | null,"id": string,"location": string | null,"participants": number,"preferred_contact": Database["public"]['Enums']["contact_method"],"price_cents": number,"reference_code": string,"service_id": string,"special_requests": string | null,"start_at": string,"status": Database["public"]['Enums']["booking_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_notes"?: string | null,"blocked_until": string,"client_id": string,"contact_name": string,"contact_phone": string,"created_at"?: string,"deposit_cents": number,"end_at": string,"hold_expires_at"?: string | null,"id"?: string,"location"?: string | null,"participants"?: number,"preferred_contact": Database["public"]['Enums']["contact_method"],"price_cents": number,"reference_code": string,"service_id": string,"special_requests"?: string | null,"start_at": string,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Update: {
                    "admin_notes"?: string | null,"blocked_until"?: string,"client_id"?: string,"contact_name"?: string,"contact_phone"?: string,"created_at"?: string,"deposit_cents"?: number,"end_at"?: string,"hold_expires_at"?: string | null,"id"?: string,"location"?: string | null,"participants"?: number,"preferred_contact"?: Database["public"]['Enums']["contact_method"],"price_cents"?: number,"reference_code"?: string,"service_id"?: string,"special_requests"?: string | null,"start_at"?: string,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"business_settings": {
                  Row: {
                    "about": string | null,"address": string | null,"buffer_minutes": number,"business_name": string,"city": string,"currency": string,"default_deposit_percent": number,"email": string | null,"facebook_url": string | null,"hold_minutes": number,"id": boolean,"instagram_url": string | null,"logo_path": string | null,"max_advance_days": number,"min_notice_hours": number,"phone": string | null,"slot_interval_minutes": number,"tagline": string | null,"tiktok_url": string | null,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "about"?: string | null,"address"?: string | null,"buffer_minutes"?: number,"business_name"?: string,"city"?: string,"currency"?: string,"default_deposit_percent"?: number,"email"?: string | null,"facebook_url"?: string | null,"hold_minutes"?: number,"id"?: boolean,"instagram_url"?: string | null,"logo_path"?: string | null,"max_advance_days"?: number,"min_notice_hours"?: number,"phone"?: string | null,"slot_interval_minutes"?: number,"tagline"?: string | null,"tiktok_url"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "about"?: string | null,"address"?: string | null,"buffer_minutes"?: number,"business_name"?: string,"city"?: string,"currency"?: string,"default_deposit_percent"?: number,"email"?: string | null,"facebook_url"?: string | null,"hold_minutes"?: number,"id"?: boolean,"instagram_url"?: string | null,"logo_path"?: string | null,"max_advance_days"?: number,"min_notice_hours"?: number,"phone"?: string | null,"slot_interval_minutes"?: number,"tagline"?: string | null,"tiktok_url"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"clients": {
                  Row: {
                    "consent_given_at": string,"consent_version": string,"created_at": string,"email": string,"full_name": string,"id": string,"phone": string,"preferred_contact": Database["public"]['Enums']["contact_method"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_given_at": string,"consent_version": string,"created_at"?: string,"email": string,"full_name": string,"id"?: string,"phone": string,"preferred_contact"?: Database["public"]['Enums']["contact_method"],"updated_at"?: string
                  }
                  Update: {
                    "consent_given_at"?: string,"consent_version"?: string,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"phone"?: string,"preferred_contact"?: Database["public"]['Enums']["contact_method"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payment_webhook_events": {
                  Row: {
                    "event_id": string,"event_type": string,"payload": NonNullable<Json>,"processed_at": string | null,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"event_type": string,"payload": NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"event_type"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"booking_id": string,"created_at": string,"currency": string,"id": string,"paid_at": string | null,"provider": string,"provider_checkout_id": string | null,"provider_payment_id": string | null,"raw": Json | null,"status": Database["public"]['Enums']["payment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"booking_id": string,"created_at"?: string,"currency"?: string,"id"?: string,"paid_at"?: string | null,"provider"?: string,"provider_checkout_id"?: string | null,"provider_payment_id"?: string | null,"raw"?: Json | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"booking_id"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"paid_at"?: string | null,"provider"?: string,"provider_checkout_id"?: string | null,"provider_payment_id"?: string | null,"raw"?: Json | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"portfolio_images": {
                  Row: {
                    "alt_text": string,"blur_data_url": string | null,"caption": string | null,"category": Database["public"]['Enums']["service_category"],"created_at": string,"height": number | null,"id": string,"is_featured": boolean,"sort_order": number,"storage_path": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text": string,"blur_data_url"?: string | null,"caption"?: string | null,"category": Database["public"]['Enums']["service_category"],"created_at"?: string,"height"?: number | null,"id"?: string,"is_featured"?: boolean,"sort_order"?: number,"storage_path": string,"width"?: number | null
                  }
                  Update: {
                    "alt_text"?: string,"blur_data_url"?: string | null,"caption"?: string | null,"category"?: Database["public"]['Enums']["service_category"],"created_at"?: string,"height"?: number | null,"id"?: string,"is_featured"?: boolean,"sort_order"?: number,"storage_path"?: string,"width"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"services": {
                  Row: {
                    "category": Database["public"]['Enums']["service_category"],"cover_image_path": string | null,"created_at": string,"deposit_cents": number | null,"description": string | null,"duration_minutes": number,"id": string,"inclusions": NonNullable<Json>,"is_active": boolean,"name": string,"price_cents": number,"slug": string,"sort_order": number,"summary": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["service_category"],"cover_image_path"?: string | null,"created_at"?: string,"deposit_cents"?: number | null,"description"?: string | null,"duration_minutes": number,"id"?: string,"inclusions"?: NonNullable<Json>,"is_active"?: boolean,"name": string,"price_cents": number,"slug": string,"sort_order"?: number,"summary"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["service_category"],"cover_image_path"?: string | null,"created_at"?: string,"deposit_cents"?: number | null,"description"?: string | null,"duration_minutes"?: number,"id"?: string,"inclusions"?: NonNullable<Json>,"is_active"?: boolean,"name"?: string,"price_cents"?: number,"slug"?: string,"sort_order"?: number,"summary"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_booking":
{ Args: { "p_consent_version": string,"p_email": string,"p_full_name": string,"p_location"?: string,"p_participants"?: number,"p_phone": string,"p_preferred_contact": Database["public"]['Enums']["contact_method"],"p_service_id": string,"p_special_requests"?: string,"p_start_at": string }; Returns: {
              "booking_id": string,"deposit_cents": number,"hold_expires_at": string,"reference_code": string,"status": Database["public"]['Enums']["booking_status"]
            }[]
                           },
"expire_stale_holds":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"get_busy_ranges":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "blocked_until": string,"start_at": string
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           }
          }
          Enums: {
            "admin_role": "owner"|"admin","booking_status": "pending_payment"|"pending"|"confirmed"|"completed"|"cancelled"|"declined"|"expired","contact_method": "email"|"phone"|"sms"|"messenger"|"viber","payment_status": "pending"|"paid"|"failed"|"expired"|"refunded","service_category": "wedding"|"portrait"|"event"|"commercial"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "admin_role": ["owner", "admin"],"booking_status": ["pending_payment", "pending", "confirmed", "completed", "cancelled", "declined", "expired"],"contact_method": ["email", "phone", "sms", "messenger", "viber"],"payment_status": ["pending", "paid", "failed", "expired", "refunded"],"service_category": ["wedding", "portrait", "event", "commercial"]
          }
        }
} as const
