import { Image } from "expo-image";
import { View } from "react-native";
import { wardrobe } from "./model";
const atlas = require("../assets/sample-garments.png");
export function GarmentImage({
  id,
  width,
  height,
}: {
  id: string;
  width: number;
  height: number;
}) {
  const piece = wardrobe.find((p) => p.id === id);
  if (!piece) return null;
  const cellWidth = Math.min(width, height / 1.5);
  const cellHeight = cellWidth * 1.5;
  return (
    <View
      accessibilityLabel={piece.name}
      accessibilityRole="image"
      style={{
        width,
        height,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
        borderRadius: 6,
      }}
    >
      <View
        style={{ width: cellWidth, height: cellHeight, overflow: "hidden" }}
      >
        <Image
          source={atlas}
          contentFit="fill"
          style={{
            position: "absolute",
            width: cellWidth * 3,
            height: cellWidth * 3,
            left: -(piece.cell % 3) * cellWidth,
            top: -Math.floor(piece.cell / 3) * cellHeight,
          }}
        />
      </View>
    </View>
  );
}
export function OutfitStrip({
  pieces,
  size,
}: {
  pieces: string[];
  size: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {pieces.map((id) => (
        <GarmentImage key={id} id={id} width={size} height={size * 1.5} />
      ))}
    </View>
  );
}
