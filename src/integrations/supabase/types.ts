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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      active_client_selections: {
        Row: {
          account_id: string
          account_label: string | null
          organization_id: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          account_label?: string | null
          organization_id: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          account_label?: string | null
          organization_id?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_client_selections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_copilot_conversations: {
        Row: {
          active_client_account_id: string | null
          active_client_platform: string | null
          created_at: string
          id: string
          organization_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_client_account_id?: string | null
          active_client_platform?: string | null
          created_at?: string
          id?: string
          organization_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_client_account_id?: string | null
          active_client_platform?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_copilot_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_copilot_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          organization_id: string
          role: string
          tool_call_id: string | null
          tool_calls: Json | null
          tool_name: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          organization_id: string
          role: string
          tool_call_id?: string | null
          tool_calls?: Json | null
          tool_name?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          tool_call_id?: string | null
          tool_calls?: Json | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_copilot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_copilot_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_copilot_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_copilot_pending_actions: {
        Row: {
          account_id: string | null
          conversation_id: string
          created_at: string
          error: string | null
          executed_at: string | null
          id: string
          message_id: string | null
          organization_id: string
          platform: string | null
          preview: string
          result: Json | null
          status: string
          tool_args: Json
          tool_call_id: string | null
          tool_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          conversation_id: string
          created_at?: string
          error?: string | null
          executed_at?: string | null
          id?: string
          message_id?: string | null
          organization_id: string
          platform?: string | null
          preview: string
          result?: Json | null
          status?: string
          tool_args?: Json
          tool_call_id?: string | null
          tool_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          conversation_id?: string
          created_at?: string
          error?: string | null
          executed_at?: string | null
          id?: string
          message_id?: string | null
          organization_id?: string
          platform?: string | null
          preview?: string
          result?: Json | null
          status?: string
          tool_args?: Json
          tool_call_id?: string | null
          tool_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_copilot_pending_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_copilot_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_copilot_pending_actions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_copilot_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_07: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_08: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_09: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_10: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_11: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2026_12: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2027_01: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2027_02: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2027_03: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2027_04: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2027_05: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2027_06: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_log_2027_07: {
        Row: {
          action: string
          actor_org_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          trace_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_org_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          actions_result: Json | null
          automation_id: string
          created_at: string
          error: string | null
          id: string
          organization_id: string
          status: string
          trigger_payload: Json | null
        }
        Insert: {
          actions_result?: Json | null
          automation_id: string
          created_at?: string
          error?: string | null
          id?: string
          organization_id: string
          status: string
          trigger_payload?: Json | null
        }
        Update: {
          actions_result?: Json | null
          automation_id?: string
          created_at?: string
          error?: string | null
          id?: string
          organization_id?: string
          status?: string
          trigger_payload?: Json | null
        }
        Relationships: []
      }
      automations: {
        Row: {
          actions: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          kind: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          kind: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          organization_id?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          due_date: string
          google_account_id: string | null
          id: string
          kind: string
          lead_id: string | null
          meta_account_id: string | null
          notes: string | null
          organization_id: string
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          due_date: string
          google_account_id?: string | null
          id?: string
          kind: string
          lead_id?: string | null
          meta_account_id?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          due_date?: string
          google_account_id?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          meta_account_id?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      global_rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      google_ad_accounts: {
        Row: {
          access_token: string | null
          connected_by: string | null
          created_at: string
          currency: string | null
          customer_id: string
          descriptive_name: string | null
          id: string
          is_manager: boolean
          manager_customer_id: string | null
          name: string
          organization_id: string
          parent_account_id: string | null
          refresh_token: string | null
          status: string
          timezone: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connected_by?: string | null
          created_at?: string
          currency?: string | null
          customer_id: string
          descriptive_name?: string | null
          id?: string
          is_manager?: boolean
          manager_customer_id?: string | null
          name: string
          organization_id: string
          parent_account_id?: string | null
          refresh_token?: string | null
          status?: string
          timezone?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connected_by?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string
          descriptive_name?: string | null
          id?: string
          is_manager?: boolean
          manager_customer_id?: string | null
          name?: string
          organization_id?: string
          parent_account_id?: string | null
          refresh_token?: string | null
          status?: string
          timezone?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ad_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_ad_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "google_ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_campaigns: {
        Row: {
          account_id: string
          budget_amount: number | null
          channel_type: string | null
          created_at: string
          end_date: string | null
          external_id: string
          id: string
          name: string
          organization_id: string
          raw: Json | null
          start_date: string | null
          status: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          account_id: string
          budget_amount?: number | null
          channel_type?: string | null
          created_at?: string
          end_date?: string | null
          external_id: string
          id?: string
          name: string
          organization_id: string
          raw?: Json | null
          start_date?: string | null
          status?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          budget_amount?: number | null
          channel_type?: string | null
          created_at?: string
          end_date?: string | null
          external_id?: string
          id?: string
          name?: string
          organization_id?: string
          raw?: Json | null
          start_date?: string | null
          status?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "google_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_ads_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_conversions: {
        Row: {
          account_id: string | null
          conversion_action: string
          conversion_date_time: string
          conversion_value: number | null
          created_at: string
          currency: string | null
          error: string | null
          gclid: string | null
          id: string
          order_id: string | null
          organization_id: string
          response: Json | null
          sent_at: string | null
          status: string
        }
        Insert: {
          account_id?: string | null
          conversion_action: string
          conversion_date_time?: string
          conversion_value?: number | null
          created_at?: string
          currency?: string | null
          error?: string | null
          gclid?: string | null
          id?: string
          order_id?: string | null
          organization_id: string
          response?: Json | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          account_id?: string | null
          conversion_action?: string
          conversion_date_time?: string
          conversion_value?: number | null
          created_at?: string
          currency?: string | null
          error?: string | null
          gclid?: string | null
          id?: string
          order_id?: string | null
          organization_id?: string
          response?: Json | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_conversions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "google_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_ads_conversions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_insights: {
        Row: {
          account_id: string
          campaign_id: string | null
          clicks: number
          conversions: number
          cost: number
          cpc: number | null
          created_at: string
          ctr: number | null
          date_start: string
          date_stop: string
          id: string
          impressions: number
          organization_id: string
          raw: Json | null
        }
        Insert: {
          account_id: string
          campaign_id?: string | null
          clicks?: number
          conversions?: number
          cost?: number
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          date_start: string
          date_stop: string
          id?: string
          impressions?: number
          organization_id: string
          raw?: Json | null
        }
        Update: {
          account_id?: string
          campaign_id?: string | null
          clicks?: number
          conversions?: number
          cost?: number
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          date_start?: string
          date_stop?: string
          id?: string
          impressions?: number
          organization_id?: string
          raw?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_insights_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "google_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_ads_insights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "google_ads_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_ads_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          completed_at: string | null
          content: string | null
          created_at: string
          id: string
          lead_id: string
          organization_id: string
          scheduled_at: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          completed_at?: string | null
          content?: string | null
          created_at?: string
          id?: string
          lead_id: string
          organization_id: string
          scheduled_at?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          content?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          organization_id?: string
          scheduled_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tag_assignments: {
        Row: {
          lead_id: string
          tag_id: string
        }
        Insert: {
          lead_id: string
          tag_id: string
        }
        Update: {
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tag_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "lead_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          campaign: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          position: number
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          campaign?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          position?: number
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          campaign?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          position?: number
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_accounts: {
        Row: {
          access_token: string | null
          ad_account_id: string
          business_id: string | null
          business_name: string | null
          connected_by: string | null
          created_at: string
          id: string
          is_client_account: boolean
          is_manager: boolean
          name: string
          organization_id: string
          parent_account_id: string | null
          pixel_id: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          ad_account_id: string
          business_id?: string | null
          business_name?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          is_client_account?: boolean
          is_manager?: boolean
          name: string
          organization_id: string
          parent_account_id?: string | null
          pixel_id?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          ad_account_id?: string
          business_id?: string | null
          business_name?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          is_client_account?: boolean
          is_manager?: boolean
          name?: string
          organization_id?: string
          parent_account_id?: string | null
          pixel_id?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads_insights: {
        Row: {
          ad_account_id: string
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number
          conversions: number
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          date_start: string
          date_stop: string
          id: string
          impressions: number
          organization_id: string
          raw: Json | null
          spend: number
        }
        Insert: {
          ad_account_id: string
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          conversions?: number
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date_start: string
          date_stop: string
          id?: string
          impressions?: number
          organization_id: string
          raw?: Json | null
          spend?: number
        }
        Update: {
          ad_account_id?: string
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          conversions?: number
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date_start?: string
          date_stop?: string
          id?: string
          impressions?: number
          organization_id?: string
          raw?: Json | null
          spend?: number
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_insights_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ads_insights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ads_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaigns: {
        Row: {
          ad_account_id: string
          created_at: string
          daily_budget: number | null
          external_id: string
          id: string
          lifetime_budget: number | null
          name: string
          objective: string | null
          organization_id: string
          raw: Json | null
          start_time: string | null
          status: string | null
          stop_time: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          daily_budget?: number | null
          external_id: string
          id?: string
          lifetime_budget?: number | null
          name: string
          objective?: string | null
          organization_id: string
          raw?: Json | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          daily_budget?: number | null
          external_id?: string
          id?: string
          lifetime_budget?: number | null
          name?: string
          objective?: string | null
          organization_id?: string
          raw?: Json | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_conversion_events: {
        Row: {
          action_source: string | null
          ad_account_id: string | null
          created_at: string
          custom_data: Json | null
          error: string | null
          event_id: string | null
          event_name: string
          event_source_url: string | null
          event_time: string
          id: string
          organization_id: string
          pixel_id: string | null
          response: Json | null
          sent_at: string | null
          status: string
          test_event_code: string | null
          user_data: Json | null
        }
        Insert: {
          action_source?: string | null
          ad_account_id?: string | null
          created_at?: string
          custom_data?: Json | null
          error?: string | null
          event_id?: string | null
          event_name: string
          event_source_url?: string | null
          event_time?: string
          id?: string
          organization_id: string
          pixel_id?: string | null
          response?: Json | null
          sent_at?: string | null
          status?: string
          test_event_code?: string | null
          user_data?: Json | null
        }
        Update: {
          action_source?: string | null
          ad_account_id?: string | null
          created_at?: string
          custom_data?: Json | null
          error?: string | null
          event_id?: string | null
          event_name?: string
          event_source_url?: string | null
          event_time?: string
          id?: string
          organization_id?: string
          pixel_id?: string | null
          response?: Json | null
          sent_at?: string | null
          status?: string
          test_event_code?: string | null
          user_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_conversion_events_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_conversion_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          organization_id: string
          provider: string
          state: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          organization_id: string
          provider: string
          state: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          organization_id?: string
          provider?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          tracking_allowed_origins: string[]
          tracking_public_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tracking_allowed_origins?: string[]
          tracking_public_key?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tracking_allowed_origins?: string[]
          tracking_public_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_integrations: {
        Row: {
          api_key: string
          created_at: string
          created_by: string | null
          environment: string
          id: string
          last_checked_at: string | null
          last_error: string | null
          organization_id: string
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          organization_id: string
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          organization_id?: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sigma_integrations: {
        Row: {
          auth_token: string | null
          auth_type: string
          base_url: string
          created_at: string
          created_by: string | null
          description: string | null
          headers: Json
          id: string
          name: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_token?: string | null
          auth_type?: string
          base_url: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          headers?: Json
          id?: string
          name: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_token?: string | null
          auth_type?: string
          base_url?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          headers?: Json
          id?: string
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sigma_requests: {
        Row: {
          created_at: string
          duration_ms: number | null
          endpoint: string
          error: string | null
          id: string
          integration_id: string
          method: string
          organization_id: string
          request_body: Json | null
          response_body: Json | null
          response_status: number | null
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          endpoint: string
          error?: string | null
          id?: string
          integration_id: string
          method: string
          organization_id: string
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          error?: string | null
          id?: string
          integration_id?: string
          method?: string
          organization_id?: string
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          organization_id: string
          plan: string
          price_cents: number
          status: string
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id: string
          plan?: string
          price_cents?: number
          status?: string
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id?: string
          plan?: string
          price_cents?: number
          status?: string
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          attachments: Json | null
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          organization_id: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id: string
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id?: string
          ticket_id?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assigned_to: string | null
          channel: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lead_id: string | null
          organization_id: string
          priority: string
          requester_email: string | null
          requester_name: string | null
          requester_phone: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          priority?: string
          requester_email?: string | null
          requester_name?: string | null
          requester_phone?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          priority?: string
          requester_email?: string | null
          requester_name?: string | null
          requester_phone?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      tracking_events: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          currency: string | null
          email: string | null
          event_name: string
          event_source_url: string | null
          external_id: string | null
          fbclid: string | null
          gbraid: string | null
          gclid: string | null
          id: string
          ip: string | null
          msclkid: string | null
          organization_id: string
          page_title: string | null
          phone: string | null
          raw: Json | null
          referrer: string | null
          session_id: string
          ttclid: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          value: number | null
          wbraid: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          event_name: string
          event_source_url?: string | null
          external_id?: string | null
          fbclid?: string | null
          gbraid?: string | null
          gclid?: string | null
          id?: string
          ip?: string | null
          msclkid?: string | null
          organization_id: string
          page_title?: string | null
          phone?: string | null
          raw?: Json | null
          referrer?: string | null
          session_id: string
          ttclid?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
          wbraid?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          event_name?: string
          event_source_url?: string | null
          external_id?: string | null
          fbclid?: string | null
          gbraid?: string | null
          gclid?: string | null
          id?: string
          ip?: string | null
          msclkid?: string | null
          organization_id?: string
          page_title?: string | null
          phone?: string | null
          raw?: Json | null
          referrer?: string | null
          session_id?: string
          ttclid?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
          wbraid?: string | null
        }
        Relationships: []
      }
      tracking_leads: {
        Row: {
          conversion_value: number
          created_at: string
          email: string | null
          events_count: number
          first_fbclid: string | null
          first_gclid: string | null
          first_landing_url: string | null
          first_referrer: string | null
          first_seen_at: string
          first_utm_campaign: string | null
          first_utm_content: string | null
          first_utm_id: string | null
          first_utm_medium: string | null
          first_utm_source: string | null
          first_utm_term: string | null
          id: string
          last_fbclid: string | null
          last_gclid: string | null
          last_seen_at: string
          last_utm_campaign: string | null
          last_utm_medium: string | null
          last_utm_source: string | null
          lead_id: string | null
          name: string | null
          organization_id: string
          phone: string | null
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          conversion_value?: number
          created_at?: string
          email?: string | null
          events_count?: number
          first_fbclid?: string | null
          first_gclid?: string | null
          first_landing_url?: string | null
          first_referrer?: string | null
          first_seen_at?: string
          first_utm_campaign?: string | null
          first_utm_content?: string | null
          first_utm_id?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          first_utm_term?: string | null
          id?: string
          last_fbclid?: string | null
          last_gclid?: string | null
          last_seen_at?: string
          last_utm_campaign?: string | null
          last_utm_medium?: string | null
          last_utm_source?: string | null
          lead_id?: string | null
          name?: string | null
          organization_id: string
          phone?: string | null
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          conversion_value?: number
          created_at?: string
          email?: string | null
          events_count?: number
          first_fbclid?: string | null
          first_gclid?: string | null
          first_landing_url?: string | null
          first_referrer?: string | null
          first_seen_at?: string
          first_utm_campaign?: string | null
          first_utm_content?: string | null
          first_utm_id?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          first_utm_term?: string | null
          id?: string
          last_fbclid?: string | null
          last_gclid?: string | null
          last_seen_at?: string
          last_utm_campaign?: string | null
          last_utm_medium?: string | null
          last_utm_source?: string | null
          lead_id?: string | null
          name?: string | null
          organization_id?: string
          phone?: string | null
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_rate_limits: {
        Row: {
          bucket: string
          count: number
          ip: string
          organization_id: string
        }
        Insert: {
          bucket: string
          count?: number
          ip: string
          organization_id: string
        }
        Update: {
          bucket?: string
          count?: number
          ip?: string
          organization_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chats: {
        Row: {
          attributed_at: string | null
          avatar_url: string | null
          conversion_currency: string | null
          conversion_status: string
          conversion_value: number | null
          converted_at: string | null
          created_at: string
          due_at: string | null
          first_fbclid: string | null
          first_gclid: string | null
          first_landing_url: string | null
          first_utm_campaign: string | null
          first_utm_content: string | null
          first_utm_source: string | null
          first_utm_term: string | null
          id: string
          instance_id: string
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          name: string | null
          organization_id: string
          payment_mode: string | null
          phone: string
          reminder_sent_at: string | null
          tracking_lead_id: string | null
          tracking_session_id: string | null
          tracking_short_code: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          attributed_at?: string | null
          avatar_url?: string | null
          conversion_currency?: string | null
          conversion_status?: string
          conversion_value?: number | null
          converted_at?: string | null
          created_at?: string
          due_at?: string | null
          first_fbclid?: string | null
          first_gclid?: string | null
          first_landing_url?: string | null
          first_utm_campaign?: string | null
          first_utm_content?: string | null
          first_utm_source?: string | null
          first_utm_term?: string | null
          id?: string
          instance_id: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          name?: string | null
          organization_id: string
          payment_mode?: string | null
          phone: string
          reminder_sent_at?: string | null
          tracking_lead_id?: string | null
          tracking_session_id?: string | null
          tracking_short_code?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          attributed_at?: string | null
          avatar_url?: string | null
          conversion_currency?: string | null
          conversion_status?: string
          conversion_value?: number | null
          converted_at?: string | null
          created_at?: string
          due_at?: string | null
          first_fbclid?: string | null
          first_gclid?: string | null
          first_landing_url?: string | null
          first_utm_campaign?: string | null
          first_utm_content?: string | null
          first_utm_source?: string | null
          first_utm_term?: string | null
          id?: string
          instance_id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          name?: string | null
          organization_id?: string
          payment_mode?: string | null
          phone?: string
          reminder_sent_at?: string | null
          tracking_lead_id?: string | null
          tracking_session_id?: string | null
          tracking_short_code?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_chats_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_chats_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_chats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_chats_tracking_lead_id_fkey"
            columns: ["tracking_lead_id"]
            isOneToOne: false
            referencedRelation: "tracking_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          base_url: string
          created_at: string
          id: string
          instance_id: string | null
          last_sync_at: string | null
          name: string
          organization_id: string
          phone_number: string | null
          provider: string
          qr_code: string | null
          status: Database["public"]["Enums"]["wa_instance_status"]
          token: string
          updated_at: string
          waba_business_id: string | null
          waba_phone_id: string | null
          webhook_secret: string
        }
        Insert: {
          base_url: string
          created_at?: string
          id?: string
          instance_id?: string | null
          last_sync_at?: string | null
          name: string
          organization_id: string
          phone_number?: string | null
          provider?: string
          qr_code?: string | null
          status?: Database["public"]["Enums"]["wa_instance_status"]
          token: string
          updated_at?: string
          waba_business_id?: string | null
          waba_phone_id?: string | null
          webhook_secret?: string
        }
        Update: {
          base_url?: string
          created_at?: string
          id?: string
          instance_id?: string | null
          last_sync_at?: string | null
          name?: string
          organization_id?: string
          phone_number?: string | null
          provider?: string
          qr_code?: string | null
          status?: Database["public"]["Enums"]["wa_instance_status"]
          token?: string
          updated_at?: string
          waba_business_id?: string | null
          waba_phone_id?: string | null
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string
          direction: Database["public"]["Enums"]["wa_message_direction"]
          external_id: string | null
          id: string
          instance_id: string
          lead_id: string | null
          media_url: string | null
          message_type: Database["public"]["Enums"]["wa_message_type"]
          metadata: Json | null
          organization_id: string
          sent_by: string | null
          status: Database["public"]["Enums"]["wa_message_status"]
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["wa_message_direction"]
          external_id?: string | null
          id?: string
          instance_id: string
          lead_id?: string | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["wa_message_type"]
          metadata?: Json | null
          organization_id: string
          sent_by?: string | null
          status?: Database["public"]["Enums"]["wa_message_status"]
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["wa_message_direction"]
          external_id?: string | null
          id?: string
          instance_id?: string
          lead_id?: string | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["wa_message_type"]
          metadata?: Json | null
          organization_id?: string
          sent_by?: string | null
          status?: Database["public"]["Enums"]["wa_message_status"]
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_tracking_codes: {
        Row: {
          code: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          organization_id: string
          phone: string | null
          session_id: string
        }
        Insert: {
          code: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          organization_id: string
          phone?: string | null
          session_id: string
        }
        Update: {
          code?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          organization_id?: string
          phone?: string | null
          session_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_write_audit_log: {
        Args: {
          _action: string
          _actor_org_id: string
          _actor_user_id: string
          _entity_id: string
          _entity_type: string
          _ip?: string
          _new_data?: Json
          _old_data?: Json
          _request_id?: string
          _trace_id?: string
          _user_agent?: string
        }
        Returns: string
      }
      audit_log_ensure_partition: {
        Args: { _month: string }
        Returns: undefined
      }
      audit_redact: { Args: { payload: Json }; Returns: Json }
      current_org_id: { Args: never; Returns: string }
      global_rate_limit_hit: {
        Args: { _key: string; _limit: number; _window_seconds?: number }
        Returns: boolean
      }
      has_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      track_rate_limit_hit: {
        Args: {
          _ip: string
          _max: number
          _org: string
          _window_seconds?: number
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "agent"
      lead_status:
        | "novo"
        | "primeiro_contato"
        | "teste_enviado"
        | "negociacao"
        | "cliente"
        | "renovacao"
        | "cancelado"
      wa_instance_status: "disconnected" | "connecting" | "connected" | "error"
      wa_message_direction: "in" | "out"
      wa_message_status: "pending" | "sent" | "delivered" | "read" | "failed"
      wa_message_type:
        | "text"
        | "image"
        | "audio"
        | "video"
        | "document"
        | "sticker"
        | "location"
        | "contact"
        | "other"
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
      app_role: ["owner", "admin", "manager", "agent"],
      lead_status: [
        "novo",
        "primeiro_contato",
        "teste_enviado",
        "negociacao",
        "cliente",
        "renovacao",
        "cancelado",
      ],
      wa_instance_status: ["disconnected", "connecting", "connected", "error"],
      wa_message_direction: ["in", "out"],
      wa_message_status: ["pending", "sent", "delivered", "read", "failed"],
      wa_message_type: [
        "text",
        "image",
        "audio",
        "video",
        "document",
        "sticker",
        "location",
        "contact",
        "other",
      ],
    },
  },
} as const
