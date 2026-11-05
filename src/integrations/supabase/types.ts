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
      campus_annual_calendar: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          event_type: string
          from_date: string
          id: string
          title: string
          to_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          event_type?: string
          from_date: string
          id?: string
          title: string
          to_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          event_type?: string
          from_date?: string
          id?: string
          title?: string
          to_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campus_cal_types: {
        Row: {
          color: string
          created_at: string
          id: string
          is_holiday: boolean
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_holiday?: boolean
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_holiday?: boolean
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
      dm_academic_calendars: {
        Row: {
          academic_year: string
          approval_note: string
          approved_at: string | null
          approved_by: string | null
          approved_name: string
          class_id: string
          class_name: string
          created_at: string
          department_id: string
          end_month: number
          id: string
          months: Json
          particulars: Json
          prepared_by: string | null
          prepared_name: string
          start_month: number
          status: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          approval_note?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_name?: string
          class_id: string
          class_name: string
          created_at?: string
          department_id: string
          end_month?: number
          id?: string
          months?: Json
          particulars?: Json
          prepared_by?: string | null
          prepared_name?: string
          start_month?: number
          status?: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          approval_note?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_name?: string
          class_id?: string
          class_name?: string
          created_at?: string
          department_id?: string
          end_month?: number
          id?: string
          months?: Json
          particulars?: Json
          prepared_by?: string | null
          prepared_name?: string
          start_month?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_academic_calendars_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_activities: {
        Row: {
          academic_year: string
          activity_date: string
          actual_output: string
          budget_amount: number
          category: string
          challenges: string
          corrective_actions: string
          created_at: string
          created_by: string | null
          deadline: string
          department_id: string
          id: string
          next_steps: string
          participants: string
          plan_id: string | null
          planned_output: string
          progress_pct: number
          responsible_name: string
          responsible_user_id: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year?: string
          activity_date?: string
          actual_output?: string
          budget_amount?: number
          category?: string
          challenges?: string
          corrective_actions?: string
          created_at?: string
          created_by?: string | null
          deadline?: string
          department_id: string
          id?: string
          next_steps?: string
          participants?: string
          plan_id?: string | null
          planned_output?: string
          progress_pct?: number
          responsible_name?: string
          responsible_user_id?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year?: string
          activity_date?: string
          actual_output?: string
          budget_amount?: number
          category?: string
          challenges?: string
          corrective_actions?: string
          created_at?: string
          created_by?: string | null
          deadline?: string
          department_id?: string
          id?: string
          next_steps?: string
          participants?: string
          plan_id?: string | null
          planned_output?: string
          progress_pct?: number
          responsible_name?: string
          responsible_user_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_activities_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_activities_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "dm_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_budget_lines: {
        Row: {
          activity_id: string | null
          approved: number
          approved_at: string | null
          approved_by: string | null
          comment: string
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          plan_id: string | null
          proposed: number
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_id?: string | null
          approved?: number
          approved_at?: string | null
          approved_by?: string | null
          comment?: string
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          plan_id?: string | null
          proposed?: number
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_id?: string | null
          approved?: number
          approved_at?: string | null
          approved_by?: string | null
          comment?: string
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          plan_id?: string | null
          proposed?: number
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_budget_lines_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "dm_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_budget_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_budget_lines_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "dm_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_budget_revisions: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          decision_comment: string
          id: string
          line_id: string
          reason: string
          requested_amount: number
          requested_at: string
          requested_by: string | null
          status: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string
          id?: string
          line_id: string
          reason?: string
          requested_amount: number
          requested_at?: string
          requested_by?: string | null
          status?: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string
          id?: string
          line_id?: string
          reason?: string
          requested_amount?: number
          requested_at?: string
          requested_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_budget_revisions_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "dm_budget_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_evidence: {
        Row: {
          activity_id: string | null
          department_id: string
          expense_id: string | null
          file_name: string
          file_path: string
          id: string
          mime: string
          size_bytes: number
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          activity_id?: string | null
          department_id: string
          expense_id?: string | null
          file_name?: string
          file_path: string
          id?: string
          mime?: string
          size_bytes?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          activity_id?: string | null
          department_id?: string
          expense_id?: string | null
          file_name?: string
          file_path?: string
          id?: string
          mime?: string
          size_bytes?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_evidence_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "dm_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_evidence_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_evidence_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "dm_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_expenses: {
        Row: {
          activity_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          department_id: string
          description: string
          expense_date: string
          id: string
          line_id: string | null
          locked: boolean
          plan_id: string | null
          reversal_of: string | null
          updated_at: string
          updated_by: string | null
          voucher_no: string
        }
        Insert: {
          activity_id?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          department_id: string
          description?: string
          expense_date?: string
          id?: string
          line_id?: string | null
          locked?: boolean
          plan_id?: string | null
          reversal_of?: string | null
          updated_at?: string
          updated_by?: string | null
          voucher_no?: string
        }
        Update: {
          activity_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string
          expense_date?: string
          id?: string
          line_id?: string | null
          locked?: boolean
          plan_id?: string | null
          reversal_of?: string | null
          updated_at?: string
          updated_by?: string | null
          voucher_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_expenses_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "dm_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_expenses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_expenses_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "dm_budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_expenses_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "dm_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_expenses_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "dm_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_plan_revisions: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          plan_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          plan_id: string
          snapshot: Json
          version: number
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          plan_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dm_plan_revisions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "dm_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_plans: {
        Row: {
          academic_year: string
          approval_comment: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          department_id: string
          end_date: string
          estimated_budget: number
          expected_outcomes: string
          funding_source: string
          id: string
          indicators: string
          objectives: string
          start_date: string
          status: string
          targets: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          academic_year: string
          approval_comment?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          department_id: string
          end_date?: string
          estimated_budget?: number
          expected_outcomes?: string
          funding_source?: string
          id?: string
          indicators?: string
          objectives?: string
          start_date?: string
          status?: string
          targets?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          academic_year?: string
          approval_comment?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string
          end_date?: string
          estimated_budget?: number
          expected_outcomes?: string
          funding_source?: string
          id?: string
          indicators?: string
          objectives?: string
          start_date?: string
          status?: string
          targets?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dm_plans_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      popup_notices: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notice_type: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notice_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notice_type?: string
          title?: string
          updated_at?: string
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
          setup_class_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          section?: string
          setup_class_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          section?: string
          setup_class_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sqc_classes_setup_class_id_fkey"
            columns: ["setup_class_id"]
            isOneToOne: false
            referencedRelation: "setup_classes"
            referencedColumns: ["id"]
          },
        ]
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
      dm_budget_decide_revision: {
        Args: { _approve: boolean; _comment?: string; _id: string }
        Returns: undefined
      }
      dm_can_read: { Args: { _dept: string }; Returns: boolean }
      dm_dept_teachers: {
        Args: { _dept: string }
        Returns: {
          dept: string
          designation: string
          name: string
          user_id: string
        }[]
      }
      dm_line_dept: { Args: { _line: string }; Returns: string }
      dm_plan_dept: { Args: { _plan: string }; Returns: string }
      get_campus_annual_calendar: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff_user: { Args: never; Returns: boolean }
      peer_class_students: {
        Args: never
        Returns: {
          central_id: string
          class_id: string
          class_name: string
          code: string
          raw_students: string
          students: Json
          subject: string
          teacher_id: string
          teacher_name: string
        }[]
      }
      set_active_academic_year: { Args: { _id: string }; Returns: undefined }
      setup_class_delete: { Args: { _id: string }; Returns: string }
      setup_class_dept: { Args: { _class: string }; Returns: string }
      sqc_class_subjects: {
        Args: never
        Returns: {
          class_id: string
          code: string
          subject: string
          teacher_id: string
          teacher_name: string
        }[]
      }
      sqc_class_teaching: {
        Args: { _class: string }
        Returns: {
          code: string
          subject: string
          teacher_id: string
          teacher_name: string
        }[]
      }
      sqc_is_member: { Args: { _class: string }; Returns: boolean }
      sqc_is_rep: { Args: { _class: string }; Returns: boolean }
      sqc_sync_classes: { Args: never; Returns: number }
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
