export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string;
          liaison_id: string;
          sender_id: string;
          content: string;
          is_read: boolean;
          created_at: string;
          updated_at: string;
          document_url: string | null;
          document_name: string | null;
        };
        Insert: {
          id?: string;
          liaison_id: string;
          sender_id: string;
          content: string;
          is_read?: boolean;
          created_at?: string;
          updated_at?: string;
          document_url?: string | null;
          document_name?: string | null;
        };
        Update: {
          id?: string;
          liaison_id?: string;
          sender_id?: string;
          content?: string;
          is_read?: boolean;
          created_at?: string;
          updated_at?: string;
          document_url?: string | null;
          document_name?: string | null;
        };
      };
    };
  };
}