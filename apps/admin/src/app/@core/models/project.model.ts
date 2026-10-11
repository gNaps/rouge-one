export interface Project {
  login_url: string;
  google_callback_url: string;
  google_configured: boolean;
  google_client_id: string;
  google_secret_id: string;
  facebook_client_id: string;
  facebook_secret_id: string;
  twitch_client_id: string;
  twitch_secret_id: string;
  github_client_id: string;
  github_secret_id: string;
  is_google_active: boolean;
  is_facebook_active: boolean;
  is_twitch_active: boolean;
  is_password_active: boolean;
  is_magic_link_active: boolean;
  redirect_url: string;
  user_id: number;
  name: string;
  description: string;
  id: number;
  tenant_code: string;
}
