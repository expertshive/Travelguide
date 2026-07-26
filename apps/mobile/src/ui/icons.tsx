import type { ImageProps } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = { color?: string; size?: number };

/** UI Kitten accessories are called with style props; only tint and size are honoured here. */
type Accessory = Partial<ImageProps>;

const DEFAULT_COLOR = '#2B3674';

function IconFrame({
  color = DEFAULT_COLOR,
  size = 22,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      {children}
    </Svg>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
    </IconFrame>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" strokeLinecap="round" />
      <Path d="M10 8l-4 4 4 4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9z" />
      <Circle cx="12" cy="13" r="3.2" />
    </IconFrame>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path
        d="M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7L11.3 6"
        strokeLinecap="round"
      />
      <Path d="M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.3-1.3" strokeLinecap="round" />
    </IconFrame>
  );
}

/** Wraps an icon so it can be passed to UI Kitten `accessoryLeft` / `accessoryRight`. */
export function accessory(Icon: (props: IconProps) => React.ReactElement, options: IconProps = {}) {
  return function Accessory(_props?: Accessory) {
    return (
      <View style={styles.accessory}>
        <Icon {...options} />
      </View>
    );
  };
}

const styles = StyleSheet.create({
  accessory: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
