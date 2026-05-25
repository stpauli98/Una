export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          client_email: string | null
          client_name: string
          client_phone: string
          confirmation_sent_at: string | null
          confirmation_token: string | null
          created_at: string
          end_time: string
          id: number
          notes: string | null
          price_snapshot: number | null
          service_id: number
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          client_email?: string | null
          client_name: string
          client_phone: string
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          created_at?: string
          end_time: string
          id?: never
          notes?: string | null
          price_snapshot?: number | null
          service_id: number
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_email?: string | null
          client_name?: string
          client_phone?: string
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          created_at?: string
          end_time?: string
          id?: never
          notes?: string | null
          price_snapshot?: number | null
          service_id?: number
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_dates: {
        Row: {
          created_at: string
          date_from: string
          date_to: string
          id: number
          reason: string | null
        }
        Insert: {
          created_at?: string
          date_from: string
          date_to: string
          id?: never
          reason?: string | null
        }
        Update: {
          created_at?: string
          date_from?: string
          date_to?: string
          id?: never
          reason?: string | null
        }
        Relationships: []
      }
      gallery_images: {
        Row: {
          alt_text: string | null
          category: string
          created_at: string
          id: number
          order_index: number
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          category: string
          created_at?: string
          id?: never
          order_index?: number
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          category?: string
          created_at?: string
          id?: never
          order_index?: number
          storage_path?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          bookable: boolean
          category: string
          created_at: string
          description: string | null
          duration_min: number | null
          duration_note: string | null
          id: number
          image_path: string | null
          name: string
          order_index: number
          price: number | null
          price_note: string | null
          variable_price: boolean
        }
        Insert: {
          active?: boolean
          bookable?: boolean
          category: string
          created_at?: string
          description?: string | null
          duration_min?: number | null
          duration_note?: string | null
          id?: never
          image_path?: string | null
          name: string
          order_index?: number
          price?: number | null
          price_note?: string | null
          variable_price?: boolean
        }
        Update: {
          active?: boolean
          bookable?: boolean
          category?: string
          created_at?: string
          description?: string | null
          duration_min?: number | null
          duration_note?: string | null
          id?: never
          image_path?: string | null
          name?: string
          order_index?: number
          price?: number | null
          price_note?: string | null
          variable_price?: boolean
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      time_blocks: {
        Row: {
          created_at: string
          end_time: string
          id: number
          reason: string | null
          recurrence_group_id: string | null
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: never
          reason?: string | null
          recurrence_group_id?: string | null
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: never
          reason?: string | null
          recurrence_group_id?: string | null
          start_time?: string
        }
        Relationships: []
      }
      training_inquiries: {
        Row: {
          created_at: string
          email: string | null
          id: number
          message: string | null
          name: string
          phone: string
          status: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: never
          message?: string | null
          name: string
          phone: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: never
          message?: string | null
          name?: string
          phone?: string
          status?: string
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          close_time: string
          day_of_week: number
          is_open: boolean
          open_time: string
        }
        Insert: {
          close_time: string
          day_of_week: number
          is_open?: boolean
          open_time: string
        }
        Update: {
          close_time?: string
          day_of_week?: number
          is_open?: boolean
          open_time?: string
        }
        Relationships: []
      }
    }
    Views: {
      time_blocks_public: {
        Row: {
          end_time: string | null
          start_time: string | null
        }
        Insert: {
          end_time?: string | null
          start_time?: string | null
        }
        Update: {
          end_time?: string | null
          start_time?: string | null
        }
        Relationships: []
      }
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
