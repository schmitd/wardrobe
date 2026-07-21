import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";

export default function Index() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  return <Redirect href={isSignedIn ? "/(tabs)/rack" : "/sign-in"} />;
}
