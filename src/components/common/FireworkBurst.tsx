import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { FireworkItem } from '../../types/app';

interface FireworkBurstProps {
  visible: boolean;
  items: FireworkItem[];
}

export function FireworkBurst({ visible, items }: FireworkBurstProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      translate.setValue(18);
      scale.setValue(0.45);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: -34,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.35,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [opacity, scale, translate, visible]);

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.area}>
      {items.map((item) => (
        <Animated.Text
          key={item.id}
          style={[
            styles.firework,
            {
              left: item.left,
              top: item.top,
              opacity,
              transform: [{ translateY: translate }, { scale }],
            },
          ]}
        >
          {item.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
  },
  firework: {
    position: 'absolute',
    fontSize: 32,
  },
});
