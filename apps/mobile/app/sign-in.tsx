import { useAuth } from "@clerk/expo";
import { AuthView } from "@clerk/expo/native";
import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme";

export default function SignIn() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  if (isSignedIn) return <Redirect href="/(tabs)/rack" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, gap: 8 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 34, lineHeight: 38, fontWeight: "900" }}>
          Your wardrobe, remembered.
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>
          Sign in to keep fits, pieces, and inspiration connected to the same style memory.
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <AuthView mode="signInOrUp" isDismissible={false} logoMaxHeight={36} />
      </View>
    </SafeAreaView>
  );
}
