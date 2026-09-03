import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
} from "./chatgpt-auth";
import { redirect } from "next/navigation";
import { getAppUser } from "../lib/auth";
import { getAccessStatus } from "../lib/access";
import AccessRequestClient from "./access-request-client";
import ScoreboardClient from "./scoreboard-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAppUser();
  if (!user) redirect(chatGPTSignInPath("/"));

  const accessStatus = await getAccessStatus(user.email);
  if (accessStatus !== "owner" && accessStatus !== "approved") {
    return (
      <AccessRequestClient
        user={{ displayName: user.displayName, email: user.email }}
        initialStatus={accessStatus}
        signOutPath={chatGPTSignOutPath("/")}
      />
    );
  }

  return (
    <ScoreboardClient
      user={{ displayName: user.displayName, email: user.email }}
      isAdmin={accessStatus === "owner"}
      signInPath={chatGPTSignInPath("/")}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
