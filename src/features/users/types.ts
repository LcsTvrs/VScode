export type Store = { id: string; code: string; name: string };
export type AdminUser = { id: string; login: string; name: string | null; role: "MASTER_ADMIN" | "STORE_ADMIN"; storeId: string | null; mustChangePassword: boolean; createdAt: string; store: { name: string; code: string } | null; isCurrentUser?: boolean };

