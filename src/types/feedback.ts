export type FeedbackType = 'bug' | 'suggestion' | 'question';
export type FeedbackStatus = 'new' | 'reviewing' | 'resolved' | 'wontfix';
export type FeedbackPriority = 'low' | 'medium' | 'high';

export interface Feedback {
    id: string;
    user_id: string;
    feedback_type: FeedbackType;
    screen_name?: string;
    description: string;
    screenshot_url?: string;
    status: FeedbackStatus;
    priority: FeedbackPriority;
    admin_notes?: string;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface CreateFeedbackInput {
    feedback_type: FeedbackType;
    screen_name?: string;
    description: string;
    screenshot_url?: string;
    metadata?: Record<string, any>;
}
