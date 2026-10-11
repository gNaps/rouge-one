export interface PublicUser { id: number; email: string; firstname: string | null; surname: string | null; image: string | null; verified: boolean }
export interface LoginConfig { name: string; tenant_code: string; redirect_uri: string; methods: { password: boolean; google: boolean; magic_link: boolean }; email: boolean }
export interface AuthorizationFlow { redirect_uri: string; code_challenge: string; state: string }
export interface TokenResponse { access_token: string; token_type: 'Bearer'; expires_in: number; user: AuthorizedUser }

export interface ProjectPermission { id: number; name: string; project_id: number }
export interface ProjectRole { id: number; name: string; project_id: number; is_default: boolean; permissions: ProjectPermission[]; user_count: number }
export interface AuthorizedUser extends PublicUser { role: { id: number; name: string }; permissions: string[] }
export interface PeopleAccessClaims { kind: 'people'; tenant: string; sub: string; iss: string; aud: string; iat: number; exp: number; version: number; role: number; roles: string[]; permissions: string[] }
