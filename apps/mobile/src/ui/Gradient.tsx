import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { gradients, type GradientName } from './tokens';

type GradientProps = ViewProps & {
  /** Named preset, or pass `colors` directly. */
  name?: GradientName;
  colors?: readonly [string, string];
  /** Direction of the gradient. */
  angle?: 'vertical' | 'horizontal' | 'diagonal';
};

/**
 * A gradient fill drawn with react-native-svg so we avoid a native linear
 * gradient dependency (no pod install / rebuild). Renders children on top.
 */
export function Gradient({
  name = 'brand',
  colors,
  angle = 'diagonal',
  style,
  children,
  ...rest
}: GradientProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [from, to] = colors ?? gradients[name];

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  const dir =
    angle === 'horizontal'
      ? { x1: '0', y1: '0', x2: '1', y2: '0' }
      : angle === 'vertical'
        ? { x1: '0', y1: '0', x2: '0', y2: '1' }
        : { x1: '0', y1: '0', x2: '1', y2: '1' };

  return (
    <View {...rest} style={[{ overflow: 'hidden' }, style]} onLayout={onLayout}>
      {size.width > 0 ? (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={size.width}
          height={size.height}
        >
          <Defs>
            <LinearGradient id="g" {...dir}>
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.width} height={size.height} fill="url(#g)" />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}
