import { Text, View } from "react-native";
import { Page, Caption, usePalette } from "../../src/ui";
import { wardrobe } from "../../src/model";
import { GarmentImage } from "../../src/garment-image";
export default function Wardrobe() {
  const c = usePalette();
  return (
    <Page>
      <Caption>Sample wardrobe · existing destination unchanged</Caption>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
        {wardrobe.map((piece) => (
          <View key={piece.id} style={{ width: "46%", gap: 8 }}>
            <GarmentImage id={piece.id} width={130} height={150} />
            <Text style={{ color: c.ink, fontSize: 17 }}>{piece.name}</Text>
          </View>
        ))}
      </View>
    </Page>
  );
}
