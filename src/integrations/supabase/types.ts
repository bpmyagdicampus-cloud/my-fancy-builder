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
      academic_years: {
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
      campus_classes: {
        Row: {
          created_at: string
          id: string
          kind: string
          no: number
          program_id: string
          section: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          no: number
          program_id: string
          section?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          no?: number
          program_id?: string
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "campus_classes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_profile: {
        Row: {
          address: string
          email: string
          id: number
          name: string
          phone: string
          updated_at: string
          website: string
        }
        Insert: {
          address?: string
          email?: string
          id?: number
          name?: string
          phone?: string
          updated_at?: string
          website?: string
        }
        Update: {
          address?: string
          email?: string
          id?: number
          name?: string
          phone?: string
          updated_at?: string
          website?: string
        }
        Relationships: []
      }
      campus_students: {
        Row: {
          active: boolean
          class_id: string
          created_at: string
          history: Json
          id: string
          name: string
          roll: number
        }
        Insert: {
          active?: boolean
          class_id: string
          created_at?: string
          history?: Json
          id?: string
          name: string
          roll?: number
        }
        Update: {
          active?: boolean
          class_id?: string
          created_at?: string
          history?: Json
          id?: string
          name?: string
          roll?: number
        }
        Relationships: [
          {
            foreignKeyName: "campus_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "campus_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      department_heads: {
        Row: {
          created_at: string
          department_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_heads_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string
          avatar_path: string | null
          bg: string | null
          campus: string
          chief: string
          dept: string
          designation: string
          hod: string
          id: string
          name: string
          username: string | null
        }
        Insert: {
          address?: string
          avatar_path?: string | null
          bg?: string | null
          campus?: string
          chief?: string
          dept?: string
          designation?: string
          hod?: string
          id: string
          name?: string
          username?: string | null
        }
        Update: {
          address?: string
          avatar_path?: string | null
          bg?: string | null
          campus?: string
          chief?: string
          dept?: string
          designation?: string
          hod?: string
          id?: string
          name?: string
          username?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          department_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_classes: {
        Row: {
          created_at: string
          department_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "setup_classes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_students: {
        Row: {
          active: boolean
          class_id: string
          created_at: string
          history: Json
          id: string
          name: string
          roll: number
        }
        Insert: {
          active?: boolean
          class_id: string
          created_at?: string
          history?: Json
          id?: string
          name: string
          roll?: number
        }
        Update: {
          active?: boolean
          class_id?: string
          created_at?: string
          history?: Json
          id?: string
          name?: string
          roll?: number
        }
        Relationships: [
          {
            foreignKeyName: "setup_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "setup_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      sqc_actions: {
        Row: {
          action_taken: string
          created_at: string
          created_by: string | null
          id: string
          report_id: string
          resolved_on: string | null
          response: string
          responsible: string
          status: string
        }
        Insert: {
          action_taken?: string
          created_at?: string
          created_by?: string | null
          id?: string
          report_id: string
          resolved_on?: string | null
          response?: string
          responsible?: string
          status: string
        }
        Update: {
          action_taken?: string
          created_at?: string
          created_by?: string | null
          id?: string
          report_id?: string
          resolved_on?: string | null
          response?: string
          responsible?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sqc_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "sqc_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      sqc_classes: {
        Row: {
          created_at: string
          id: string
          name: string
          section: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          section?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          section?: string
        }
        Relationships: []
      }
      sqc_members: {
        Row: {
          class_id: string
          created_at: string
          is_rep: boolean
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          is_rep?: boolean
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          is_rep?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sqc_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "sqc_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      sqc_periods: {
        Row: {
          end_time: string
          period_no: number
          start_time: string
        }
        Insert: {
          end_time: string
          period_no: number
          start_time: string
        }
        Update: {
          end_time?: string
          period_no?: number
          start_time?: string
        }
        Relationships: []
      }
      sqc_reports: {
        Row: {
          arrival_time: string | null
          class_id: string
          departure_time: string | null
          facilities: string
          held: boolean
          id: string
          issues: string
          not_held_reason: string
          period_no: number
          present_count: number | null
          report_date: string
          requests: string
          status: string
          subject: string
          submitted_at: string
          submitted_by: string | null
          submitted_by_name: string
          suggestions: string
          teacher_id: string | null
          teacher_name: string
          total_count: number | null
          updated_at: string
          year_name: string
        }
        Insert: {
          arrival_time?: string | null
          class_id: string
          departure_time?: string | null
          facilities?: string
          held: boolean
          id?: string
          issues?: string
          not_held_reason?: string
          period_no: number
          present_count?: number | null
          report_date: string
          requests?: string
          status?: string
          subject?: string
          submitted_at?: string
          submitted_by?: string | null
          submitted_by_name?: string
          suggestions?: string
          teacher_id?: string | null
          teacher_name?: string
          total_count?: number | null
          updated_at?: string
          year_name?: string
        }
        Update: {
          arrival_time?: string | null
          class_id?: string
          departure_time?: string | null
          facilities?: string
          held?: boolean
          id?: string
          issues?: string
          not_held_reason?: string
          period_no?: number
          present_count?: number | null
          report_date?: string
          requests?: string
          status?: string
          subject?: string
          submitted_at?: string
          submitted_by?: string | null
          submitted_by_name?: string
          suggestions?: string
          teacher_id?: string | null
          teacher_name?: string
          total_count?: number | null
          updated_at?: string
          year_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sqc_reports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "sqc_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_data: {
        Row: {
          content: Json
          teacher_id: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: Json
          teacher_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: Json
          teacher_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_data_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_admin: { Args: { _email: string }; Returns: string }
      campus_class_dept: { Args: { _class: string }; Returns: string }
      campus_program_dept: { Args: { _program: string }; Returns: string }
      can_manage_dept: { Args: { _dept: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff_user: { Args: never; Returns: boolean }
      set_active_academic_year: { Args: { _id: string }; Returns: undefined }
      setup_class_dept: { Args: { _class: string }; Returns: string }
      sqc_is_member: { Args: { _class: string }; Returns: boolean }
      sqc_is_rep: { Args: { _class: string }; Returns: boolean }
      sqc_teacher_list: {
        Args: never
        Returns: {
          teacher_id: string
          teacher_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student"
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
      app_role: ["admin", "teacher", "student"],
    },
  },
} as const
