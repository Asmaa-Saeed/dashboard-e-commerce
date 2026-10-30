// Generated from supabase/01_setup.sql + 02_security_and_logic.sql.
// After the database changes, regenerate with: npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          id: number
          store_id: string
          conversation_id: string | null
          type: string
          product_id: string | null
          query: string | null
          payload: Json
          created_at: string
        }
        Insert: {
          id?: number
          store_id: string
          conversation_id?: string | null
          type: string
          product_id?: string | null
          query?: string | null
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: number
          store_id?: string
          conversation_id?: string | null
          type?: string
          product_id?: string | null
          query?: string | null
          payload?: Json
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "analytics_events_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "analytics_events_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "analytics_events_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      bot_settings: {
        Row: {
          store_id: string
          enabled: boolean
          assistant_name: string
          llm_enabled: boolean
          llm_provider: string
          llm_model: string
          candidate_products: number
          max_products_default: number
          max_products_asked: number
          max_quantity_per_item: number
          featured_category_ids: string[]
          hidden_category_ids: string[]
          use_thumbnails: boolean
          handoff_whatsapp: string | null
          greeting_text: string | null
          updated_at: string
        }
        Insert: {
          store_id: string
          enabled?: boolean
          assistant_name?: string
          llm_enabled?: boolean
          llm_provider?: string
          llm_model?: string
          candidate_products?: number
          max_products_default?: number
          max_products_asked?: number
          max_quantity_per_item?: number
          featured_category_ids?: string[]
          hidden_category_ids?: string[]
          use_thumbnails?: boolean
          handoff_whatsapp?: string | null
          greeting_text?: string | null
          updated_at?: string
        }
        Update: {
          store_id?: string
          enabled?: boolean
          assistant_name?: string
          llm_enabled?: boolean
          llm_provider?: string
          llm_model?: string
          candidate_products?: number
          max_products_default?: number
          max_products_asked?: number
          max_quantity_per_item?: number
          featured_category_ids?: string[]
          hidden_category_ids?: string[]
          use_thumbnails?: boolean
          handoff_whatsapp?: string | null
          greeting_text?: string | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "bot_settings_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      categories: {
        Row: {
          id: string
          store_id: string
          external_id: string
          title: string
          parent_external_id: string | null
          synonyms: string[]
          hidden: boolean
          sort: number
        }
        Insert: {
          id?: string
          store_id: string
          external_id: string
          title: string
          parent_external_id?: string | null
          synonyms?: string[]
          hidden?: boolean
          sort?: number
        }
        Update: {
          id?: string
          store_id?: string
          external_id?: string
          title?: string
          parent_external_id?: string | null
          synonyms?: string[]
          hidden?: boolean
          sort?: number
        }
        Relationships: [
          { foreignKeyName: "categories_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      channels: {
        Row: {
          id: string
          store_id: string
          type: string
          external_id: string
          display_name: string | null
          status: string
          last_error: string | null
          connected_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          type: string
          external_id: string
          display_name?: string | null
          status?: string
          last_error?: string | null
          connected_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          type?: string
          external_id?: string
          display_name?: string | null
          status?: string
          last_error?: string | null
          connected_at?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "channels_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      conversations: {
        Row: {
          id: string
          store_id: string
          channel_id: string | null
          channel_type: string
          external_user_id: string
          customer_id: string | null
          display_name: string | null
          state: Json
          status: string
          handoff_reason: string | null
          handoff_at: string | null
          handled_by: string | null
          handled_at: string | null
          bot_paused_until: string | null
          last_message_at: string | null
          last_message_preview: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          channel_id?: string | null
          channel_type: string
          external_user_id: string
          customer_id?: string | null
          display_name?: string | null
          state?: Json
          status?: string
          handoff_reason?: string | null
          handoff_at?: string | null
          handled_by?: string | null
          handled_at?: string | null
          bot_paused_until?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          channel_id?: string | null
          channel_type?: string
          external_user_id?: string
          customer_id?: string | null
          display_name?: string | null
          state?: Json
          status?: string
          handoff_reason?: string | null
          handoff_at?: string | null
          handled_by?: string | null
          handled_at?: string | null
          bot_paused_until?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "conversations_channel_id_store_id_fkey"; columns: ["channel_id", "store_id"]; isOneToOne: false; referencedRelation: "channels"; referencedColumns: ["id", "store_id"] },
          { foreignKeyName: "conversations_customer_id_store_id_fkey"; columns: ["customer_id", "store_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id", "store_id"] },
          { foreignKeyName: "conversations_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      customers: {
        Row: {
          id: string
          store_id: string
          name: string | null
          phone: string | null
          city: string | null
          address: string | null
          first_channel: string | null
          orders_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name?: string | null
          phone?: string | null
          city?: string | null
          address?: string | null
          first_channel?: string | null
          orders_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string | null
          phone?: string | null
          city?: string | null
          address?: string | null
          first_channel?: string | null
          orders_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "customers_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      delivery_companies: {
        Row: {
          id: string
          store_id: string
          name: string
          copy_template: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          copy_template?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          copy_template?: string | null
          active?: boolean
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "delivery_companies_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      delivery_zones: {
        Row: {
          id: string
          store_id: string
          name: string
          fee: number
          aliases: string[]
          eta_text: string | null
          sort: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          fee: number
          aliases?: string[]
          eta_text?: string | null
          sort?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          fee?: number
          aliases?: string[]
          eta_text?: string | null
          sort?: number
          active?: boolean
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "delivery_zones_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      inventory_movements: {
        Row: {
          id: number
          store_id: string
          variant_id: string
          delta: number
          reason: string
          order_id: string | null
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: number
          store_id: string
          variant_id: string
          delta: number
          reason: string
          order_id?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          store_id?: string
          variant_id?: string
          delta?: number
          reason?: string
          order_id?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "inventory_movements_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
          { foreignKeyName: "inventory_movements_variant_id_store_id_fkey"; columns: ["variant_id", "store_id"]; isOneToOne: false; referencedRelation: "product_variants"; referencedColumns: ["id", "store_id"] },
        ]
      }
      llm_usage: {
        Row: {
          id: number
          store_id: string
          conversation_id: string | null
          purpose: string
          provider: string
          model: string
          input_tokens: number
          output_tokens: number
          cost_usd: number
          created_at: string
        }
        Insert: {
          id?: number
          store_id: string
          conversation_id?: string | null
          purpose: string
          provider: string
          model: string
          input_tokens?: number
          output_tokens?: number
          cost_usd?: number
          created_at?: string
        }
        Update: {
          id?: number
          store_id?: string
          conversation_id?: string | null
          purpose?: string
          provider?: string
          model?: string
          input_tokens?: number
          output_tokens?: number
          cost_usd?: number
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "llm_usage_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "llm_usage_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      messages: {
        Row: {
          id: number
          store_id: string
          conversation_id: string
          role: string
          text: string | null
          intent: string | null
          meta: Json
          created_at: string
        }
        Insert: {
          id?: number
          store_id: string
          conversation_id: string
          role: string
          text?: string | null
          intent?: string | null
          meta?: Json
          created_at?: string
        }
        Update: {
          id?: number
          store_id?: string
          conversation_id?: string
          role?: string
          text?: string | null
          intent?: string | null
          meta?: Json
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "messages_conversation_id_store_id_fkey"; columns: ["conversation_id", "store_id"]; isOneToOne: false; referencedRelation: "conversations"; referencedColumns: ["id", "store_id"] },
          { foreignKeyName: "messages_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      order_items: {
        Row: {
          id: string
          store_id: string
          order_id: string
          product_id: string | null
          variant_id: string | null
          product_name: string
          option_label: string | null
          quantity: number
          unit_price: number
          line_total: number | null
        }
        Insert: {
          id?: string
          store_id: string
          order_id: string
          product_id?: string | null
          variant_id?: string | null
          product_name: string
          option_label?: string | null
          quantity: number
          unit_price: number
          line_total?: never
        }
        Update: {
          id?: string
          store_id?: string
          order_id?: string
          product_id?: string | null
          variant_id?: string | null
          product_name?: string
          option_label?: string | null
          quantity?: number
          unit_price?: number
          line_total?: never
        }
        Relationships: [
          { foreignKeyName: "order_items_order_id_store_id_fkey"; columns: ["order_id", "store_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id", "store_id"] },
          { foreignKeyName: "order_items_product_id_store_id_fkey"; columns: ["product_id", "store_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id", "store_id"] },
          { foreignKeyName: "order_items_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
          { foreignKeyName: "order_items_variant_id_store_id_fkey"; columns: ["variant_id", "store_id"]; isOneToOne: false; referencedRelation: "product_variants"; referencedColumns: ["id", "store_id"] },
        ]
      }
      order_requests: {
        Row: {
          id: string
          store_id: string
          order_id: string
          type: string
          text: string | null
          status: string
          resolved_by: string | null
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          order_id: string
          type: string
          text?: string | null
          status?: string
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          order_id?: string
          type?: string
          text?: string | null
          status?: string
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "order_requests_order_id_store_id_fkey"; columns: ["order_id", "store_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id", "store_id"] },
          { foreignKeyName: "order_requests_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      order_status_history: {
        Row: {
          id: number
          store_id: string
          order_id: string
          from_status: string | null
          to_status: string
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: number
          store_id: string
          order_id: string
          from_status?: string | null
          to_status: string
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          store_id?: string
          order_id?: string
          from_status?: string | null
          to_status?: string
          changed_by?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "order_status_history_order_id_store_id_fkey"; columns: ["order_id", "store_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id", "store_id"] },
          { foreignKeyName: "order_status_history_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      orders: {
        Row: {
          id: string
          store_id: string
          ref: string
          idempotency_key: string | null
          source: string
          conversation_id: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          customer_phone2: string | null
          city: string | null
          zone_id: string | null
          zone_name: string | null
          address: string | null
          subtotal: number
          delivery_fee: number
          total: number | null
          currency: string
          payment_method: string
          status: string
          stock_applied: boolean
          delivery_company_id: string | null
          tracking_no: string | null
          customer_note: string | null
          staff_note: string | null
          cancel_reason: string | null
          is_demo: boolean
          confirmed_at: string | null
          shipped_at: string | null
          delivered_at: string | null
          cancelled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          ref: string
          idempotency_key?: string | null
          source?: string
          conversation_id?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          customer_phone2?: string | null
          city?: string | null
          zone_id?: string | null
          zone_name?: string | null
          address?: string | null
          subtotal: number
          delivery_fee?: number
          total?: never
          currency?: string
          payment_method?: string
          status?: string
          stock_applied?: boolean
          delivery_company_id?: string | null
          tracking_no?: string | null
          customer_note?: string | null
          staff_note?: string | null
          cancel_reason?: string | null
          is_demo?: boolean
          confirmed_at?: string | null
          shipped_at?: string | null
          delivered_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          ref?: string
          idempotency_key?: string | null
          source?: string
          conversation_id?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          customer_phone2?: string | null
          city?: string | null
          zone_id?: string | null
          zone_name?: string | null
          address?: string | null
          subtotal?: number
          delivery_fee?: number
          total?: never
          currency?: string
          payment_method?: string
          status?: string
          stock_applied?: boolean
          delivery_company_id?: string | null
          tracking_no?: string | null
          customer_note?: string | null
          staff_note?: string | null
          cancel_reason?: string | null
          is_demo?: boolean
          confirmed_at?: string | null
          shipped_at?: string | null
          delivered_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "orders_conversation_id_store_id_fkey"; columns: ["conversation_id", "store_id"]; isOneToOne: false; referencedRelation: "conversations"; referencedColumns: ["id", "store_id"] },
          { foreignKeyName: "orders_customer_id_store_id_fkey"; columns: ["customer_id", "store_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id", "store_id"] },
          { foreignKeyName: "orders_delivery_company_id_store_id_fkey"; columns: ["delivery_company_id", "store_id"]; isOneToOne: false; referencedRelation: "delivery_companies"; referencedColumns: ["id", "store_id"] },
          { foreignKeyName: "orders_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
          { foreignKeyName: "orders_zone_id_store_id_fkey"; columns: ["zone_id", "store_id"]; isOneToOne: false; referencedRelation: "delivery_zones"; referencedColumns: ["id", "store_id"] },
        ]
      }
      platform_admins: {
        Row: {
          user_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          created_at?: string
        }
        Relationships: [
        ]
      }
      product_variants: {
        Row: {
          id: string
          store_id: string
          product_id: string
          external_id: string
          color: string | null
          size: string | null
          label: string | null
          price: number | null
          original_price: number | null
          image_url: string | null
          in_feed: boolean
          out_of_stock: boolean
          stock_qty: number | null
          low_stock_threshold: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          product_id: string
          external_id: string
          color?: string | null
          size?: string | null
          label?: string | null
          price?: number | null
          original_price?: number | null
          image_url?: string | null
          in_feed?: boolean
          out_of_stock?: boolean
          stock_qty?: number | null
          low_stock_threshold?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          product_id?: string
          external_id?: string
          color?: string | null
          size?: string | null
          label?: string | null
          price?: number | null
          original_price?: number | null
          image_url?: string | null
          in_feed?: boolean
          out_of_stock?: boolean
          stock_qty?: number | null
          low_stock_threshold?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "product_variants_product_id_store_id_fkey"; columns: ["product_id", "store_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id", "store_id"] },
          { foreignKeyName: "product_variants_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      products: {
        Row: {
          id: string
          store_id: string
          external_id: string
          name: string
          subtitle: string | null
          description: string | null
          url: string | null
          image_url: string | null
          thumbnail_url: string | null
          images: Json
          category_ids: string[]
          price: number | null
          original_price: number | null
          max_price: number | null
          attributes: Json
          options: Json
          review_status: string
          issues: Json
          in_feed: boolean
          manual_hidden: boolean
          out_of_stock: boolean
          source_hash: string | null
          synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          external_id: string
          name: string
          subtitle?: string | null
          description?: string | null
          url?: string | null
          image_url?: string | null
          thumbnail_url?: string | null
          images?: Json
          category_ids?: string[]
          price?: number | null
          original_price?: number | null
          max_price?: number | null
          attributes?: Json
          options?: Json
          review_status?: string
          issues?: Json
          in_feed?: boolean
          manual_hidden?: boolean
          out_of_stock?: boolean
          source_hash?: string | null
          synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          external_id?: string
          name?: string
          subtitle?: string | null
          description?: string | null
          url?: string | null
          image_url?: string | null
          thumbnail_url?: string | null
          images?: Json
          category_ids?: string[]
          price?: number | null
          original_price?: number | null
          max_price?: number | null
          attributes?: Json
          options?: Json
          review_status?: string
          issues?: Json
          in_feed?: boolean
          manual_hidden?: boolean
          out_of_stock?: boolean
          source_hash?: string | null
          synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "products_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      store_members: {
        Row: {
          store_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          store_id: string
          user_id: string
          role?: string
          created_at?: string
        }
        Update: {
          store_id?: string
          user_id?: string
          role?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "store_members_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      store_policies: {
        Row: {
          store_id: string
          payment_methods: string[]
          delivery_time_text: string | null
          exchange_allowed: boolean
          exchange_text: string | null
          cancellation_text: string | null
          working_hours: string | null
          wholesale_text: string | null
          extra_faq: Json
          updated_at: string
        }
        Insert: {
          store_id: string
          payment_methods?: string[]
          delivery_time_text?: string | null
          exchange_allowed?: boolean
          exchange_text?: string | null
          cancellation_text?: string | null
          working_hours?: string | null
          wholesale_text?: string | null
          extra_faq?: Json
          updated_at?: string
        }
        Update: {
          store_id?: string
          payment_methods?: string[]
          delivery_time_text?: string | null
          exchange_allowed?: boolean
          exchange_text?: string | null
          cancellation_text?: string | null
          working_hours?: string | null
          wholesale_text?: string | null
          extra_faq?: Json
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "store_policies_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] },
        ]
      }
      stores: {
        Row: {
          id: string
          slug: string
          name: string
          logo_url: string | null
          brand_color: string
          website_url: string | null
          whatsapp: string | null
          phone: string | null
          currency: string
          currency_symbol: string
          dialect: string
          timezone: string
          order_ref_prefix: string
          status: string
          trial_ends_at: string | null
          subscription_renews_at: string | null
          inventory_mode: string
          wholesale_enabled: boolean
          catalog_source: string
          catalog_config: Json
          catalog_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          logo_url?: string | null
          brand_color?: string
          website_url?: string | null
          whatsapp?: string | null
          phone?: string | null
          currency?: string
          currency_symbol?: string
          dialect?: string
          timezone?: string
          order_ref_prefix?: string
          status?: string
          trial_ends_at?: string | null
          subscription_renews_at?: string | null
          inventory_mode?: string
          wholesale_enabled?: boolean
          catalog_source?: string
          catalog_config?: Json
          catalog_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          logo_url?: string | null
          brand_color?: string
          website_url?: string | null
          whatsapp?: string | null
          phone?: string | null
          currency?: string
          currency_symbol?: string
          dialect?: string
          timezone?: string
          order_ref_prefix?: string
          status?: string
          trial_ends_at?: string | null
          subscription_renews_at?: string | null
          inventory_mode?: string
          wholesale_enabled?: boolean
          catalog_source?: string
          catalog_config?: Json
          catalog_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      add_store_member: { Args: { p_store: string; p_email: string; p_role?: string }; Returns: undefined }
      admin_create_store: { Args: { p_name: string; p_slug: string; p_order_ref_prefix: string; p_owner_email?: string }; Returns: string }
      admin_store_overview: { Args: never; Returns: { store_id: string; name: string; slug: string; status: string; trial_ends_at: string | null; subscription_renews_at: string | null; bot_enabled: boolean | null; channels_connected: number; conversations_30d: number; orders_30d: number; orders_value_30d: number; llm_cost_usd_30d: number; last_message_at: string | null }[] }
      is_platform_admin: { Args: never; Returns: boolean }
      is_store_member: { Args: { p_store: string }; Returns: boolean }
      is_store_owner: { Args: { p_store: string }; Returns: boolean }
      queue_staff_reply: { Args: { p_conversation: string; p_text: string }; Returns: Json }
      my_stores: { Args: never; Returns: { store_id: string; slug: string; name: string; role: string; brand_color: string; logo_url: string | null }[] }
      store_stats: { Args: { p_store: string; p_from: string; p_to?: string }; Returns: Json }
      store_team: { Args: { p_store: string }; Returns: { user_id: string; email: string; role: string; created_at: string }[] }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
