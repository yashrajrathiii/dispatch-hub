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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      buyers: {
        Row: {
          address: string | null
          category: Database["public"]["Enums"]["buyer_category"]
          created_at: string
          email: string | null
          gstin: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          category?: Database["public"]["Enums"]["buyer_category"]
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["buyer_category"]
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      dispatch_stops: {
        Row: {
          address: string | null
          buyer_id: string | null
          completed_at: string | null
          dispatch_id: string
          id: string
          items_summary: Json | null
          latitude: number | null
          longitude: number | null
          status: Database["public"]["Enums"]["dispatch_stop_status"]
          stop_sequence: number
        }
        Insert: {
          address?: string | null
          buyer_id?: string | null
          completed_at?: string | null
          dispatch_id: string
          id?: string
          items_summary?: Json | null
          latitude?: number | null
          longitude?: number | null
          status?: Database["public"]["Enums"]["dispatch_stop_status"]
          stop_sequence?: number
        }
        Update: {
          address?: string | null
          buyer_id?: string | null
          completed_at?: string | null
          dispatch_id?: string
          id?: string
          items_summary?: Json | null
          latitude?: number | null
          longitude?: number | null
          status?: Database["public"]["Enums"]["dispatch_stop_status"]
          stop_sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_stops_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_stops_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatches: {
        Row: {
          created_at: string
          dispatch_date: string
          driver_user_id: string | null
          id: string
          order_id: string | null
          start_shop_id: string | null
          status: Database["public"]["Enums"]["dispatch_status"]
          total_distance_km: number | null
          total_duration_min: number | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          dispatch_date?: string
          driver_user_id?: string | null
          id?: string
          order_id?: string | null
          start_shop_id?: string | null
          status?: Database["public"]["Enums"]["dispatch_status"]
          total_distance_km?: number | null
          total_duration_min?: number | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          dispatch_date?: string
          driver_user_id?: string | null
          id?: string
          order_id?: string | null
          start_shop_id?: string | null
          status?: Database["public"]["Enums"]["dispatch_status"]
          total_distance_km?: number | null
          total_duration_min?: number | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_driver_user_id_fkey"
            columns: ["driver_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_start_shop_id_fkey"
            columns: ["start_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          id: string
          last_updated_at: string
          min_threshold: number
          product_id: string
          quantity: number
          shop_id: string
          updated_by_user_id: string | null
        }
        Insert: {
          id?: string
          last_updated_at?: string
          min_threshold?: number
          product_id: string
          quantity?: number
          shop_id: string
          updated_by_user_id?: string | null
        }
        Update: {
          id?: string
          last_updated_at?: string
          min_threshold?: number
          product_id?: string
          quantity?: number
          shop_id?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_logs: {
        Row: {
          change_type: Database["public"]["Enums"]["inventory_change_type"]
          created_at: string
          created_by_user_id: string | null
          id: string
          note: string | null
          product_id: string
          quantity_change: number
          shop_id: string
        }
        Insert: {
          change_type: Database["public"]["Enums"]["inventory_change_type"]
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          note?: string | null
          product_id: string
          quantity_change: number
          shop_id: string
        }
        Update: {
          change_type?: Database["public"]["Enums"]["inventory_change_type"]
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          note?: string | null
          product_id?: string
          quantity_change?: number
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_logs_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          recipient_user_id: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_user_id: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_user_id?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          allocated_qty: number
          id: string
          line_total: number
          order_id: string
          product_id: string
          requested_qty: number
          unit_price: number
        }
        Insert: {
          allocated_qty?: number
          id?: string
          line_total?: number
          order_id: string
          product_id: string
          requested_qty?: number
          unit_price?: number
        }
        Update: {
          allocated_qty?: number
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string
          requested_qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          channel: Database["public"]["Enums"]["order_channel"]
          created_at: string
          created_by_user_id: string | null
          delivery_date: string | null
          delivery_slot: Database["public"]["Enums"]["delivery_slot"] | null
          id: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          shop_id: string | null
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          buyer_id: string
          channel?: Database["public"]["Enums"]["order_channel"]
          created_at?: string
          created_by_user_id?: string | null
          delivery_date?: string | null
          delivery_slot?: Database["public"]["Enums"]["delivery_slot"] | null
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shop_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          buyer_id?: string
          channel?: Database["public"]["Enums"]["order_channel"]
          created_at?: string
          created_by_user_id?: string | null
          delivery_date?: string | null
          delivery_slot?: Database["public"]["Enums"]["delivery_slot"] | null
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shop_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          effective_date: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          effective_date?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          effective_date?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          buyer_category: Database["public"]["Enums"]["buyer_category"]
          id: string
          price_list_id: string
          price_per_unit: number
          product_id: string
        }
        Insert: {
          buyer_category: Database["public"]["Enums"]["buyer_category"]
          id?: string
          price_list_id: string
          price_per_unit: number
          product_id: string
        }
        Update: {
          buyer_category?: Database["public"]["Enums"]["buyer_category"]
          id?: string
          price_list_id?: string
          price_per_unit?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          id: string
          is_active: boolean
          name: string
          sku: string
          unit: string
        }
        Insert: {
          brand_id?: string | null
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sku: string
          unit?: string
        }
        Update: {
          brand_id?: string | null
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sku?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          type: Database["public"]["Enums"]["shop_type"]
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          type?: Database["public"]["Enums"]["shop_type"]
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          type?: Database["public"]["Enums"]["shop_type"]
        }
        Relationships: []
      }
      users: {
        Row: {
          assigned_shop_id: string | null
          auth_user_id: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          assigned_shop_id?: string | null
          auth_user_id: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          assigned_shop_id?: string | null
          auth_user_id?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_assigned_shop_id_fkey"
            columns: ["assigned_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      walkin_items: {
        Row: {
          id: string
          line_total: number
          product_id: string
          quantity: number
          unit_price: number
          walkin_purchase_id: string
        }
        Insert: {
          id?: string
          line_total?: number
          product_id: string
          quantity?: number
          unit_price?: number
          walkin_purchase_id: string
        }
        Update: {
          id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          unit_price?: number
          walkin_purchase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "walkin_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walkin_items_walkin_purchase_id_fkey"
            columns: ["walkin_purchase_id"]
            isOneToOne: false
            referencedRelation: "walkin_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      walkin_purchases: {
        Row: {
          bill_status: Database["public"]["Enums"]["bill_status"]
          buyer_id: string | null
          buyer_name_override: string | null
          buyer_phone_override: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          photo_proof_url: string | null
          shop_id: string | null
          total_amount: number
        }
        Insert: {
          bill_status?: Database["public"]["Enums"]["bill_status"]
          buyer_id?: string | null
          buyer_name_override?: string | null
          buyer_phone_override?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          photo_proof_url?: string | null
          shop_id?: string | null
          total_amount?: number
        }
        Update: {
          bill_status?: Database["public"]["Enums"]["bill_status"]
          buyer_id?: string | null
          buyer_name_override?: string | null
          buyer_phone_override?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          photo_proof_url?: string | null
          shop_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "walkin_purchases_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walkin_purchases_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walkin_purchases_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
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
      app_role: "owner" | "admin" | "staff" | "accountant" | "driver"
      bill_status: "PENDING" | "BILLED" | "SENT"
      buyer_category: "DEALER" | "RETAILER" | "WALKIN"
      delivery_slot: "MORNING" | "AFTERNOON" | "EVENING"
      dispatch_status: "PLANNED" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED"
      dispatch_stop_status: "PENDING" | "DELIVERED" | "FAILED"
      inventory_change_type: "RECEIVED" | "SOLD" | "ADJUSTED" | "DISPATCHED"
      notification_type: "BILLING" | "LOW_STOCK" | "ORDER" | "DISPATCH"
      order_channel: "MANUAL" | "WALKIN"
      order_status:
        | "PENDING"
        | "CONFIRMED"
        | "DISPATCHED"
        | "DELIVERED"
        | "CANCELLED"
      payment_status: "PENDING" | "PARTIAL" | "PAID"
      product_category: "Dhuli" | "Dryfruits" | "Oil" | "Other"
      shop_type: "GODOWN" | "SHOP"
      user_role: "OWNER" | "ADMIN" | "STAFF" | "ACCOUNTANT" | "DRIVER"
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
      app_role: ["owner", "admin", "staff", "accountant", "driver"],
      bill_status: ["PENDING", "BILLED", "SENT"],
      buyer_category: ["DEALER", "RETAILER", "WALKIN"],
      delivery_slot: ["MORNING", "AFTERNOON", "EVENING"],
      dispatch_status: ["PLANNED", "IN_TRANSIT", "COMPLETED", "CANCELLED"],
      dispatch_stop_status: ["PENDING", "DELIVERED", "FAILED"],
      inventory_change_type: ["RECEIVED", "SOLD", "ADJUSTED", "DISPATCHED"],
      notification_type: ["BILLING", "LOW_STOCK", "ORDER", "DISPATCH"],
      order_channel: ["MANUAL", "WALKIN"],
      order_status: [
        "PENDING",
        "CONFIRMED",
        "DISPATCHED",
        "DELIVERED",
        "CANCELLED",
      ],
      payment_status: ["PENDING", "PARTIAL", "PAID"],
      product_category: ["Dhuli", "Dryfruits", "Oil", "Other"],
      shop_type: ["GODOWN", "SHOP"],
      user_role: ["OWNER", "ADMIN", "STAFF", "ACCOUNTANT", "DRIVER"],
    },
  },
} as const
