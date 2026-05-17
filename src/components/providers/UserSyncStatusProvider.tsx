"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useSyncUser, type UserSyncState } from "@/hooks/useSyncUser";

const UserSyncStatusContext = createContext<UserSyncState>({
  status: "loading",
});

export function UserSyncStatusProvider({
  children,
}: {
  children: ReactNode;
}) {
  const syncState = useSyncUser();

  return (
    <UserSyncStatusContext.Provider value={syncState}>
      {children}
    </UserSyncStatusContext.Provider>
  );
}

export const useUserSyncStatus = () => useContext(UserSyncStatusContext);
