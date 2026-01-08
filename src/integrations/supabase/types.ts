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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          created_at: string
          id: string
          payload: Json
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          type?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          account_id: string
          created_at: string
          id: string
          name: string
          status_cache: string | null
          tags: Json | null
          updated_at: string
          voluum_campaign_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          name: string
          status_cache?: string | null
          tags?: Json | null
          updated_at?: string
          voluum_campaign_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          name?: string
          status_cache?: string | null
          tags?: Json | null
          updated_at?: string
          voluum_campaign_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "voluum_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_snapshots: {
        Row: {
          account_id: string
          clicks: number
          conversions: number
          cost: number
          created_at: string
          cvr: number | null
          epc: number | null
          id: string
          profit: number
          revenue: number
          roi: number | null
          voluum_campaign_id: string
          window_end: string
          window_start: string
        }
        Insert: {
          account_id: string
          clicks?: number
          conversions?: number
          cost?: number
          created_at?: string
          cvr?: number | null
          epc?: number | null
          id?: string
          profit?: number
          revenue?: number
          roi?: number | null
          voluum_campaign_id: string
          window_end: string
          window_start: string
        }
        Update: {
          account_id?: string
          clicks?: number
          conversions?: number
          cost?: number
          created_at?: string
          cvr?: number | null
          epc?: number | null
          id?: string
          profit?: number
          revenue?: number
          roi?: number | null
          voluum_campaign_id?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "voluum_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      rule_triggers: {
        Row: {
          action_result: Json | null
          error: string | null
          id: string
          rule_id: string
          snapshot_id: string | null
          status: string
          triggered_at: string
          voluum_campaign_id: string
        }
        Insert: {
          action_result?: Json | null
          error?: string | null
          id?: string
          rule_id: string
          snapshot_id?: string | null
          status?: string
          triggered_at?: string
          voluum_campaign_id: string
        }
        Update: {
          action_result?: Json | null
          error?: string | null
          id?: string
          rule_id?: string
          snapshot_id?: string | null
          status?: string
          triggered_at?: string
          voluum_campaign_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_triggers_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_triggers_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "metrics_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          account_id: string | null
          actions: Json
          conditions: Json
          cooldown_minutes: number
          created_at: string
          id: string
          is_enabled: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          actions?: Json
          conditions?: Json
          cooldown_minutes?: number
          created_at?: string
          id?: string
          is_enabled?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          actions?: Json
          conditions?: Json
          cooldown_minutes?: number
          created_at?: string
          id?: string
          is_enabled?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "voluum_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      voluum_accounts: {
        Row: {
          access_key_ref: string | null
          auth_header: string
          base_url: string
          created_at: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          access_key_ref?: string | null
          auth_header?: string
          base_url?: string
          created_at?: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          access_key_ref?: string | null
          auth_header?: string
          base_url?: string
          created_at?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
