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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          completed_at: string | null
          contact_id: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_completed: boolean | null
          responsible_id: string | null
          scheduled_for: string
          subject: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          completed_at?: string | null
          contact_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean | null
          responsible_id?: string | null
          scheduled_for: string
          subject: string
          type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean | null
          responsible_id?: string | null
          scheduled_for?: string
          subject?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activities_org"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activities_org"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      ai_agent_knowledge_files: {
        Row: {
          agent_id: string
          content_extracted: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          is_processed: boolean | null
        }
        Insert: {
          agent_id: string
          content_extracted?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          is_processed?: boolean | null
        }
        Update: {
          agent_id?: string
          content_extracted?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          is_processed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_knowledge_files_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          agent_type: string
          api_key_encrypted: string | null
          api_provider: string
          auto_responses_enabled: boolean | null
          created_at: string
          description: string | null
          fallback_message: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          knowledge_base_enabled: boolean | null
          max_tokens: number | null
          model: string
          name: string
          response_delay_ms: number | null
          system_instructions: string | null
          temperature: number | null
          updated_at: string
          working_days: number[] | null
          working_hours_enabled: boolean | null
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          agent_type?: string
          api_key_encrypted?: string | null
          api_provider?: string
          auto_responses_enabled?: boolean | null
          created_at?: string
          description?: string | null
          fallback_message?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          knowledge_base_enabled?: boolean | null
          max_tokens?: number | null
          model?: string
          name: string
          response_delay_ms?: number | null
          system_instructions?: string | null
          temperature?: number | null
          updated_at?: string
          working_days?: number[] | null
          working_hours_enabled?: boolean | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          agent_type?: string
          api_key_encrypted?: string | null
          api_provider?: string
          auto_responses_enabled?: boolean | null
          created_at?: string
          description?: string | null
          fallback_message?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          knowledge_base_enabled?: boolean | null
          max_tokens?: number | null
          model?: string
          name?: string
          response_delay_ms?: number | null
          system_instructions?: string | null
          temperature?: number | null
          updated_at?: string
          working_days?: number[] | null
          working_hours_enabled?: boolean | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cep: string | null
          cidade: string | null
          cpf_cnpj: string | null
          created_at: string
          data_cadastro: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          metadata: Json | null
          nome: string
          observacoes: string | null
          status: string
          telefone: string | null
          tipo_pessoa: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_cadastro?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          metadata?: Json | null
          nome: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          tipo_pessoa?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_cadastro?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          metadata?: Json | null
          nome?: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          tipo_pessoa?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      connection_secrets: {
        Row: {
          connection_id: string
          created_at: string | null
          evolution_url: string
          id: string
          token: string
          updated_at: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string | null
          evolution_url?: string
          id?: string
          token: string
          updated_at?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string | null
          evolution_url?: string
          id?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connection_secrets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          created_at: string | null
          history_recovery: string | null
          history_status: string | null
          id: string
          instance_name: string
          last_activity_at: string | null
          metadata: Json | null
          phone_number: string | null
          qr_code: string | null
          status: string
          updated_at: string | null
          use_workspace_default: boolean | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          history_recovery?: string | null
          history_status?: string | null
          id?: string
          instance_name: string
          last_activity_at?: string | null
          metadata?: Json | null
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string | null
          use_workspace_default?: boolean | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          history_recovery?: string | null
          history_status?: string | null
          id?: string
          instance_name?: string
          last_activity_at?: string | null
          metadata?: Json | null
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string | null
          use_workspace_default?: boolean | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          extra_info: Json | null
          id: string
          name: string
          phone: string | null
          profile_image_updated_at: string | null
          profile_image_url: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          extra_info?: Json | null
          id?: string
          name: string
          phone?: string | null
          profile_image_updated_at?: string | null
          profile_image_url?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          extra_info?: Json | null
          id?: string
          name?: string
          phone?: string | null
          profile_image_updated_at?: string | null
          profile_image_url?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      conversation_assignments: {
        Row: {
          action: string
          changed_at: string
          changed_by: string
          conversation_id: string
          from_assigned_user_id: string | null
          id: string
          to_assigned_user_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by: string
          conversation_id: string
          from_assigned_user_id?: string | null
          id?: string
          to_assigned_user_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string
          conversation_id?: string
          from_assigned_user_id?: string | null
          id?: string
          to_assigned_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          left_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agente_ativo: boolean | null
          assigned_at: string | null
          assigned_user_id: string | null
          canal: string | null
          connection_id: string | null
          contact_id: string
          created_at: string
          evolution_instance: string | null
          id: string
          last_activity_at: string | null
          last_message_at: string | null
          priority: string | null
          queue_id: string | null
          status: string
          unread_count: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agente_ativo?: boolean | null
          assigned_at?: string | null
          assigned_user_id?: string | null
          canal?: string | null
          connection_id?: string | null
          contact_id: string
          created_at?: string
          evolution_instance?: string | null
          id?: string
          last_activity_at?: string | null
          last_message_at?: string | null
          priority?: string | null
          queue_id?: string | null
          status?: string
          unread_count?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agente_ativo?: boolean | null
          assigned_at?: string | null
          assigned_user_id?: string | null
          canal?: string | null
          connection_id?: string | null
          contact_id?: string
          created_at?: string
          evolution_instance?: string | null
          id?: string
          last_activity_at?: string | null
          last_message_at?: string | null
          priority?: string | null
          queue_id?: string | null
          status?: string
          unread_count?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_connection_fk"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "fk_conversations_contact_id"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_conversations_queue_id"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_cards: {
        Row: {
          action_url: string | null
          created_at: string
          description: string
          id: string
          image_url: string | null
          is_active: boolean
          metadata: Json | null
          order_position: number
          title: string
          type: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json | null
          order_position?: number
          title: string
          type: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          action_url?: string | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json | null
          order_position?: number
          title?: string
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      evolution_instance_tokens: {
        Row: {
          created_at: string
          evolution_url: string
          id: string
          instance_name: string
          token: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          evolution_url?: string
          id?: string
          instance_name: string
          token: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          evolution_url?: string
          id?: string
          instance_name?: string
          token?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolution_instance_tokens_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolution_instance_tokens_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      instance_user_assignments: {
        Row: {
          created_at: string
          id: string
          instance: string
          is_default: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance: string
          is_default?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance?: string
          is_default?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      internal_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_message_at: string | null
          participants: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string | null
          participants?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string | null
          participants?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      internal_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          message_type: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          external_id: string | null
          file_name: string | null
          file_url: string | null
          id: string
          message_type: string
          metadata: Json | null
          mime_type: string | null
          origem_resposta: string | null
          read_at: string | null
          sender_id: string | null
          sender_type: string
          status: string | null
          workspace_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          external_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          mime_type?: string | null
          origem_resposta?: string | null
          read_at?: string | null
          sender_id?: string | null
          sender_type: string
          status?: string | null
          workspace_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          external_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          mime_type?: string | null
          origem_resposta?: string | null
          read_at?: string | null
          sender_id?: string | null
          sender_type?: string
          status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_messages_conversation_id"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      provider_logs: {
        Row: {
          connection_id: string | null
          correlation_id: string
          created_at: string | null
          event_type: string
          id: string
          level: string
          message: string
          metadata: Json | null
        }
        Insert: {
          connection_id?: string | null
          correlation_id: string
          created_at?: string | null
          event_type: string
          id?: string
          level?: string
          message: string
          metadata?: Json | null
        }
        Update: {
          connection_id?: string | null
          correlation_id?: string
          created_at?: string | null
          event_type?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      queues: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_user_cargos: {
        Row: {
          cargo_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          cargo_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          cargo_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_user_cargos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_user_cargos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
      system_users: {
        Row: {
          avatar: string | null
          cargo_id: string | null
          created_at: string
          default_channel: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          profile: string
          senha: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          cargo_id?: string | null
          created_at?: string
          default_channel?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          profile: string
          senha?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          cargo_id?: string | null
          created_at?: string
          default_channel?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          profile?: string
          senha?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tags_org"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tags_org"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "tags_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string
          instance_id: string | null
          payload_json: Json | null
          response_body: string | null
          response_status: number | null
          status: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          instance_id?: string | null
          payload_json?: Json | null
          response_body?: string | null
          response_status?: number | null
          status?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          instance_id?: string | null
          payload_json?: Json | null
          response_body?: string | null
          response_status?: number | null
          status?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_limits: {
        Row: {
          connection_limit: number
          created_at: string | null
          id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          connection_limit?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          connection_limit?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          is_hidden: boolean
          role: Database["public"]["Enums"]["system_profile"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          role?: Database["public"]["Enums"]["system_profile"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          role?: Database["public"]["Enums"]["system_profile"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_webhook_secrets: {
        Row: {
          created_at: string | null
          id: string
          secret_name: string
          updated_at: string | null
          webhook_url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          secret_name: string
          updated_at?: string | null
          webhook_url: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          secret_name?: string
          updated_at?: string | null
          webhook_url?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_webhook_settings: {
        Row: {
          created_at: string | null
          updated_at: string | null
          webhook_secret: string
          webhook_url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          updated_at?: string | null
          webhook_secret: string
          webhook_url: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          updated_at?: string | null
          webhook_secret?: string
          webhook_url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_webhook_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_webhook_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspaces: {
        Row: {
          cnpj: string | null
          created_at: string | null
          id: string
          name: string
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          id?: string
          name: string
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      system_users_view: {
        Row: {
          avatar: string | null
          cargo_id: string | null
          cargo_ids: string[] | null
          created_at: string | null
          default_channel: string | null
          email: string | null
          id: string | null
          name: string | null
          profile: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      workspaces_view: {
        Row: {
          cnpj: string | null
          connections_count: number | null
          created_at: string | null
          name: string | null
          slug: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      block_system_user: {
        Args: { user_email: string }
        Returns: undefined
      }
      clear_all_conversations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_connection_anon: {
        Args: {
          p_history_recovery: string
          p_instance_name: string
          p_metadata?: Json
        }
        Returns: string
      }
      current_system_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      debug_current_user: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      debug_user_permissions: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      delete_connection_anon: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      get_current_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_system_user: {
        Args: { user_email: string; user_password: string }
        Returns: {
          avatar: string
          cargo_id: string
          created_at: string
          email: string
          id: string
          name: string
          profile: string
          status: string
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          role_name: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Returns: boolean
      }
      hash_password: {
        Args: { password: string }
        Returns: string
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_current_user_master: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_master: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_member: {
        Args: {
          min_role?: Database["public"]["Enums"]["org_role"]
          org_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: {
          p_min_role?: Database["public"]["Enums"]["system_profile"]
          p_workspace_id: string
        }
        Returns: boolean
      }
      list_connections_anon: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          history_recovery: string
          id: string
          instance_name: string
          last_activity_at: string
          metadata: Json
          phone_number: string
          qr_code: string
          status: string
          workspace_id: string
        }[]
      }
      slugify: {
        Args: { txt: string }
        Returns: string
      }
      sync_user_roles: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_connection_status_anon: {
        Args: {
          p_connection_id: string
          p_metadata?: Json
          p_phone_number?: string
          p_qr_code?: string
          p_status: string
        }
        Returns: undefined
      }
      verify_password: {
        Args: { hash: string; password: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "master" | "user" | "admin"
      org_role: "OWNER" | "ADMIN" | "USER"
      system_profile: "master" | "admin" | "user"
      workspace_role: "mentor_master" | "gestor" | "colaborador"
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
      app_role: ["master", "user", "admin"],
      org_role: ["OWNER", "ADMIN", "USER"],
      system_profile: ["master", "admin", "user"],
      workspace_role: ["mentor_master", "gestor", "colaborador"],
    },
  },
} as const
