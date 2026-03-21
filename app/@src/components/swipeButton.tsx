import { View, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { GestureDetector, PanGesture } from "react-native-gesture-handler";

interface SwipeButtonProps {
  panGesture: PanGesture;
  trackStyle: any;
  animatedStyle: any;
}

export default function SwipeButton({
  panGesture,
  trackStyle,
  animatedStyle,
}: SwipeButtonProps) {
  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.sliderContainer}>
        <Animated.View style={[styles.track, trackStyle]}>
          <Text style={styles.trackText}>Swipe to Send →</Text>
        </Animated.View>
        <Animated.View style={[styles.thumb, animatedStyle]}>
          <Text style={styles.thumbText}>→</Text>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "space-between",
    paddingTop: 120,
    paddingBottom: 60,
  },
  content: {
    alignItems: "center",
  },
  label: {
    color: "#666",
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: 20,
  },
  number: {
    color: "#fff",
    fontSize: 120,
    fontWeight: "200",
    marginBottom: 10,
  },
  variation: {
    color: "#999",
    fontSize: 18,
  },
  completedContainer: {
    alignItems: "center",
    padding: 40,
  },
  completedText: {
    color: "#4ade80",
    fontSize: 24,
    fontWeight: "500",
    marginBottom: 8,
  },
  completedSubtext: {
    color: "#666",
    fontSize: 16,
  },
  sliderContainer: {
    marginHorizontal: 20,
    height: 70,
    position: "relative",
  },
  track: {
    height: 70,
    backgroundColor: "#1a1a1a",
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  trackText: {
    color: "#666",
    fontSize: 16,
  },
  thumb: {
    position: "absolute",
    left: 5,
    top: 5,
    width: 60,
    height: 60,
    backgroundColor: "#fff",
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  thumbText: {
    fontSize: 24,
  },
});
